"use client";
import { useEffect, useState } from "react";
import { answerCareerQuestion, suggestedQuestions } from "@/features/careers/assistant";
import { sampleCareerById, sampleCareers } from "@/features/careers/sample-data";
import { ASSISTANT_NOTICE, ASSISTANT_QUESTION_LIMIT, assistantAnswerSchema, assistantConfigSchema, assistantUserPrompt, type AssistantConfig } from "@/features/careers/ai-schema";
import { redactOfferForAi } from "@/features/offer/ai-redaction";
import { appRequest } from "@/features/authority/client";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";
import { userMessage } from "@/lib/user-error";

const storageKey = "oryqen.career-skills.v1";
// Every answer carries its source: "rules" (fixed rules and the SAMPLE framework) or "ai" (written by the approved AI provider after the person agreed to send the question).
type Turn = { question: string; lines: string[]; source: "rules" | "ai"; provider?: string; note?: string };
const firstId = sampleCareers[0]?.id ?? "welder";

// Career Assistant. Without real AI it answers from rules and says so. Real AI answers appear only when the site owner has enabled and approved a provider AND the person
// ticks the consent box; the exact text that leaves ORYQEN is shown first. The conversation is not stored. `anonymous` (the public demo page) never contacts the server.
export function CareerAssistant({ anonymous = false }: { anonymous?: boolean }) {
  const { t } = useI18n();
  const [skills, setSkills] = useState<string[]>([]), [careerId, setCareerId] = useState(firstId), [question, setQuestion] = useState(""), [turns, setTurns] = useState<Turn[]>([]);
  const [config, setConfig] = useState<AssistantConfig | null>(null), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      await Promise.resolve();
      if (!live) return;
      try { const raw = JSON.parse(window.localStorage.getItem(storageKey) ?? "null"); if (raw && Array.isArray(raw.skills)) { setSkills(raw.skills.filter((item: unknown): item is string => typeof item === "string")); if (typeof raw.careerId === "string") setCareerId(raw.careerId); } } catch { /* no saved skills on this device */ }
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (anonymous) return;
    let live = true;
    // If the configuration cannot be read, real AI simply stays off and the rules keep answering.
    appRequest("/api/v1/career-assistant").then(raw => { if (live) setConfig(assistantConfigSchema.parse(raw)); }).catch(() => { if (live) setConfig(null); });
    return () => { live = false; };
  }, [anonymous]);
  const aiReady = Boolean(config?.configured && config.provider && config.policyHash);
  const providerName = config?.provider ? t(`ai.name.${config.provider}` as MessageKey) : "";
  const role = sampleCareerById(careerId)?.title ?? "";
  const add = (turn: Turn) => setTurns(current => [...current, turn].slice(-20));
  const rules = (clean: string, note?: string) => add({ question: clean, lines: answerCareerQuestion(clean, { skills, careerId }).text, source: "rules", ...(note ? { note } : {}) });
  async function ask(text: string) {
    const clean = text.trim().slice(0, ASSISTANT_QUESTION_LIMIT);
    if (!clean || busy) return;
    setQuestion("");
    if (!aiReady || !consent || !config?.provider || !config.policyHash || clean.length < 3) { rules(clean); return; }
    setBusy(true);
    try {
      const result = assistantAnswerSchema.parse(await appRequest("/api/v1/career-assistant", { question: clean, careerId, skills, consent: { provider: config.provider, policyHash: config.policyHash, noticeVersion: ASSISTANT_NOTICE, transmit: true, adultConfirmed: true } }, undefined, "POST", { timeoutMs: 60000 }));
      if (result.status === "SUCCESS" && result.answer) add({ question: clean, lines: result.answer.split(/\n+/).map(line => line.trim()).filter(Boolean), source: "ai", provider: providerName });
      else rules(clean, `${t("ca.aiFailed")} ${result.message}`.trim());
    } catch (caught) { rules(clean, `${t("ca.aiFailed")} ${userMessage(caught, "")}`.trim()); }
    finally { setBusy(false); }
  }
  return <section className="oq-rec" aria-label={t("ca.aria")}>
    <p className="fw-notice" role="note"><strong>{t(aiReady ? "ca.mixedLabel" : "ca.demoLabel")}</strong> {t(aiReady ? "ca.mixedBody" : "ca.demoBody")}</p>
    {!anonymous && <section className="fw-list-card oq-ai-box" aria-label={t("ca.aiTitle")}>
      <h3>{t("ca.aiTitle")}</h3>
      {!aiReady && <p role="status">{t("ca.aiOff")}</p>}
      {aiReady && config && <>
        <p>{t("ca.aiIntro", { provider: providerName, model: config.model ?? "" })}</p>
        <p>{t("ca.aiRegion", { region: config.processingRegion ?? "", use: config.dataUse ?? "" })}</p>
        <label className="fw-field">{t("ca.aiSentLabel")}<textarea readOnly rows={6} value={redactOfferForAi(assistantUserPrompt(question.trim() || t("ca.aiPlaceholder"), { role, skills }))} /></label>
        <p>{t("ca.aiNoStore")}</p>
        <label className="fw-field"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />{t("ca.aiConsent", { provider: providerName })}</label>
      </>}
    </section>}
    <label className="fw-field">{t("ca.target")}<select value={careerId} onChange={e => setCareerId(e.target.value)}>{sampleCareers.map(career => <option key={career.id} value={career.id}>{career.title}</option>)}</select></label>
    <p>{skills.length === 0 ? t("ca.noSkills") : t("ca.usingSkills", { count: skills.length })}</p>
    <div className="oq-rec-chips" role="group" aria-label={t("ca.suggestedAria")}>{suggestedQuestions.map(item => <button key={item} type="button" className="fw-secondary" disabled={busy} onClick={() => void ask(item)}>{item}</button>)}</div>
    <ol className="oq-rec-list" aria-label={t("ca.conversationAria")}>{turns.map((turn, index) => <li key={index} data-source={turn.source}>
      <p><strong>{t("ca.you")}:</strong> {turn.question}</p>
      {turn.note && <p role="status">{turn.note}</p>}
      <div><p><strong>{t("ca.assistant")} ({turn.source === "ai" ? t("ca.aiTag", { provider: turn.provider ?? "" }) : t("ca.demoTag")}):</strong></p>{turn.lines.map((line, i) => <p key={i}>{line}</p>)}</div>
    </li>)}</ol>
    {busy && <p role="status">{t("ca.aiThinking")}</p>}
    {turns.length === 0 && !busy && <p>{t("ca.empty")}</p>}
    <form onSubmit={e => { e.preventDefault(); void ask(question); }}>
      <label className="fw-field">{t("ca.ask")}<input maxLength={300} value={question} onChange={e => setQuestion(e.target.value)} /></label>
      <button className="fw-primary" type="submit" disabled={!question.trim() || busy}>{t("ca.send")}</button>
      {turns.length > 0 && <button className="fw-secondary" type="button" onClick={() => setTurns([])}>{t("ca.clear")}</button>}
    </form>
    <p className="fw-notice">{t("ca.notice")}</p>
  </section>;
}

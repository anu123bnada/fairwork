"use client";
import { useEffect, useState } from "react";
import { answerCareerQuestion, suggestedQuestions, type AssistantAnswer } from "@/features/careers/assistant";
import { sampleCareers } from "@/features/careers/sample-data";
import { useI18n } from "@/i18n/use-i18n";
import "./records.css";

const storageKey = "oryqen.career-skills.v1";
type Turn = { question: string; answer: AssistantAnswer };
const firstId = sampleCareers[0]?.id ?? "welder";

// Career Assistant: a DEMO that answers from rules and the SAMPLE framework. It is not an AI model and does not store the conversation.
export function CareerAssistant() {
  const { t } = useI18n();
  const [skills, setSkills] = useState<string[]>([]), [careerId, setCareerId] = useState(firstId), [question, setQuestion] = useState(""), [turns, setTurns] = useState<Turn[]>([]);
  useEffect(() => {
    let live = true;
    (async () => {
      await Promise.resolve();
      if (!live) return;
      try { const raw = JSON.parse(window.localStorage.getItem(storageKey) ?? "null"); if (raw && Array.isArray(raw.skills)) { setSkills(raw.skills.filter((item: unknown): item is string => typeof item === "string")); if (typeof raw.careerId === "string") setCareerId(raw.careerId); } } catch { /* no saved skills on this device */ }
    })();
    return () => { live = false; };
  }, []);
  const ask = (text: string) => { const clean = text.trim(); if (!clean) return; setTurns(current => [...current, { question: clean, answer: answerCareerQuestion(clean, { skills, careerId }) }].slice(-20)); setQuestion(""); };
  return <section className="oq-rec" aria-label={t("ca.aria")}>
    <p className="fw-notice" role="note"><strong>{t("ca.demoLabel")}</strong> {t("ca.demoBody")}</p>
    <label className="fw-field">{t("ca.target")}<select value={careerId} onChange={e => setCareerId(e.target.value)}>{sampleCareers.map(career => <option key={career.id} value={career.id}>{career.title}</option>)}</select></label>
    <p>{skills.length === 0 ? t("ca.noSkills") : t("ca.usingSkills", { count: skills.length })}</p>
    <div className="oq-rec-chips" role="group" aria-label={t("ca.suggestedAria")}>{suggestedQuestions.map(item => <button key={item} type="button" className="fw-secondary" onClick={() => ask(item)}>{item}</button>)}</div>
    <ol className="oq-rec-list" aria-label={t("ca.conversationAria")}>{turns.map((turn, index) => <li key={index}>
      <p><strong>{t("ca.you")}:</strong> {turn.question}</p>
      <div><p><strong>{t("ca.assistant")} ({t("ca.demoTag")}):</strong></p>{turn.answer.text.map((line, i) => <p key={i}>{line}</p>)}</div>
    </li>)}</ol>
    {turns.length === 0 && <p>{t("ca.empty")}</p>}
    <form onSubmit={e => { e.preventDefault(); ask(question); }}>
      <label className="fw-field">{t("ca.ask")}<input maxLength={300} value={question} onChange={e => setQuestion(e.target.value)} /></label>
      <button className="fw-primary" type="submit" disabled={!question.trim()}>{t("ca.send")}</button>
      {turns.length > 0 && <button className="fw-secondary" type="button" onClick={() => setTurns([])}>{t("ca.clear")}</button>}
    </form>
    <p className="fw-notice">{t("ca.notice")}</p>
  </section>;
}

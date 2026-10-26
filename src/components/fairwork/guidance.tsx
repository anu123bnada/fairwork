"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { guidanceDeleteReceipt, guidancePage, guidanceRead, guidanceSend, type GuidancePage } from "@/features/guidance/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

export function GuidanceScreen() {
  const { t } = useI18n();
  const topicLabel = (value: string) => { const key = `gd.t.${value}`; const text = t(key as MessageKey); return text === key ? value : text; };
  const [data, setData] = useState<GuidancePage | null>(null), [error, setError] = useState("");
  const [question, setQuestion] = useState(""), [topic, setTopic] = useState("offer"), [offerId, setOfferId] = useState("");
  const [busy, setBusy] = useState(true), [thread, setThread] = useState<string | null>(null), [confirming, setConfirming] = useState(false), [notice, setNotice] = useState("");
  const keys = useRef(new Map<string, string>()), generation = useRef(0);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const input = guidanceRead.safeParse({ operation: "read", threadId: params.get("threadId") });
    const path = input.success && input.data.threadId ? `/api/v1/guidance?threadId=${input.data.threadId}` : "/api/v1/guidance";
    appRequest(path).then(raw => { if (active) { const result = guidancePage.parse(raw); setData(result); setThread(result.threadId); } })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : t("gd.historyFail")); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [t]);
  async function load(id: string | null) {
    const current = ++generation.current; setBusy(true); setData(null); setError(""); setQuestion("");
    try {
      const result = guidancePage.parse(await appRequest(`/api/v1/guidance${id ? `?threadId=${id}` : ""}`));
      if (current === generation.current) { setData(result); setThread(id); window.history.replaceState(window.history.state, "", `/app/guidance${id ? `?threadId=${id}` : ""}`); }
    } catch (caught) { if (current === generation.current) setError(caught instanceof Error ? caught.message : t("gd.loadFail")); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function erase() {
    if (!thread) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const receipt = guidanceDeleteReceipt.parse(await appRequest("/api/v1/guidance", { operation: "delete", threadId: thread }));
      setConfirming(false); setNotice(receipt.deleted > 0 ? t("gd.deleted") : t("gd.alreadyEmpty"));
      setThread(null); window.history.replaceState(window.history.state, "", "/app/guidance");
      setData(guidancePage.parse(await appRequest("/api/v1/guidance")));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("gd.deleteFail")); }
    finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const id = thread ?? crypto.randomUUID(); setThread(id);
    const body = { operation: "send", threadId: id, question, topic, offerId: offerId.trim() || null };
    const fingerprint = JSON.stringify(body); let key = keys.current.get(fingerprint);
    if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
    const parsed = guidanceSend.safeParse({ ...body, idempotencyKey: key });
    if (!parsed.success) { setError(t("gd.invalid")); return; }
    setBusy(true); setError(""); setData(null);
    try { const result = guidancePage.parse(await appRequest("/api/v1/guidance", parsed.data)); setData(result); setQuestion(""); keys.current.delete(fingerprint); window.history.replaceState(window.history.state, "", `/app/guidance?threadId=${id}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("gd.saveFail")); }
    finally { setBusy(false); }
  }
  return <section className="fw-opportunities" aria-label={t("gd.aria")}>
    <p className="fw-notice">{t("gd.notice")}</p>
    <p>{t("gd.privacy")}</p>
    <button className="fw-secondary" disabled={busy} onClick={() => void load(null)}>{t("gd.new")}</button>
    <button className="fw-secondary" disabled={busy} onClick={() => void load(thread)}>{t("gd.reload")}</button>
    {!!thread && !!data?.turns.length && (confirming
      ? <span role="group" aria-label={t("gd.confirmAria")}><button className="fw-secondary" disabled={busy} onClick={() => void erase()}>{t("gd.deleteNow")}</button><button className="fw-secondary" disabled={busy} onClick={() => setConfirming(false)}>{t("gd.keep")}</button></span>
      : <button className="fw-secondary" disabled={busy} onClick={() => { setConfirming(true); setNotice(""); }}>{t("gd.delete")}</button>)}
    {notice && <p role="status">{notice}</p>}
    {!!data?.threads.length && <details><summary>{t("gd.recent")}</summary>{data.threads.map((item, index) => <button key={item.id} className="fw-secondary" disabled={busy} onClick={() => void load(item.id)}>{t("gd.convLine", { n: index + 1, date: new Date(item.updatedAt).toLocaleString() })}</button>)}</details>}
    {busy && <p role="status">{t("gd.loading")}</p>}{error && <p role="alert">{error}</p>}
    <div aria-label={t("gd.historyAria")}>{data?.turns.map(turn => <article className="fw-list-card" key={turn.ordinal}>
      <h3>{t("gd.yourQuestion")}</h3><p>{turn.question}</p><h4>{t("gd.rulesBased", { topic: topicLabel(turn.topic) })}</h4><p>{turn.response.text}</p>
      <p>{t("gd.source", { source: turn.response.source, version: turn.response.sourceVersion })}</p>
      {turn.response.context && <p>{t("gd.context", { version: turn.response.context.version, open: turn.response.context.openQuestions })} <Link href={`/app/agreement?offerId=${turn.response.context.offerId}`}>{t("gd.reviewOffer")}</Link></p>}
      <Link className="fw-secondary" href={turn.response.destination}>{t("gd.openWorkspace")}</Link><small>{t("gd.noAction")}</small>
    </article>)}</div>
    {data?.turns.length === 0 && <p>{t("gd.noMessages")}</p>}
    <form onSubmit={event => void send(event)}><fieldset disabled={busy || data?.turns.length === 100}>
      <label className="fw-field">{t("gd.topic")}<select value={topic} onChange={event => setTopic(event.target.value)}>{(["offer", "agreement", "evidence", "passport", "opportunities"] as const).map(value => <option key={value} value={value}>{topicLabel(value)}</option>)}</select></label>
      <label className="fw-field">{t("gd.offerId")}<input value={offerId} onChange={event => setOfferId(event.target.value)} maxLength={36} /></label>
      <label className="fw-field">{t("gd.question")}<textarea required maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} /></label>
      <button className="fw-primary" disabled={!question.trim()}>{t("gd.submit")}</button>
    </fieldset></form>
    {data?.turns.length === 100 && <p>{t("gd.limit")}</p>}
  </section>;
}

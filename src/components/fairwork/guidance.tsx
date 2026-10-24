"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { guidancePage, guidanceRead, guidanceSend, type GuidancePage } from "@/features/guidance/schema";

export function GuidanceScreen() {
  const [data, setData] = useState<GuidancePage | null>(null), [error, setError] = useState("");
  const [question, setQuestion] = useState(""), [topic, setTopic] = useState("offer"), [offerId, setOfferId] = useState("");
  const [busy, setBusy] = useState(true), [thread, setThread] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>()), generation = useRef(0);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const input = guidanceRead.safeParse({ operation: "read", threadId: params.get("threadId") });
    const path = input.success && input.data.threadId ? `/api/v1/guidance?threadId=${input.data.threadId}` : "/api/v1/guidance";
    appRequest(path).then(raw => { if (active) { const result = guidancePage.parse(raw); setData(result); setThread(result.threadId); } })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Guidance history is unavailable."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function load(id: string | null) {
    const current = ++generation.current; setBusy(true); setData(null); setError(""); setQuestion("");
    try {
      const result = guidancePage.parse(await appRequest(`/api/v1/guidance${id ? `?threadId=${id}` : ""}`));
      if (current === generation.current) { setData(result); setThread(id); window.history.replaceState(window.history.state, "", `/app/guidance${id ? `?threadId=${id}` : ""}`); }
    } catch (caught) { if (current === generation.current) setError(caught instanceof Error ? caught.message : "History is unavailable. Check access to linked offers."); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const id = thread ?? crypto.randomUUID(); setThread(id);
    const body = { operation: "send", threadId: id, question, topic, offerId: offerId.trim() || null };
    const fingerprint = JSON.stringify(body); let key = keys.current.get(fingerprint);
    if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
    const parsed = guidanceSend.safeParse({ ...body, idempotencyKey: key });
    if (!parsed.success) { setError("Enter a question and, if supplied, a valid saved offer ID."); return; }
    setBusy(true); setError(""); setData(null);
    try { const result = guidancePage.parse(await appRequest("/api/v1/guidance", parsed.data)); setData(result); setQuestion(""); keys.current.delete(fingerprint); window.history.replaceState(window.history.state, "", `/app/guidance?threadId=${id}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The reply could not be saved. Retry the same question to recover safely."); }
    finally { setBusy(false); }
  }
  return <section className="fw-opportunities" aria-label="Private guidance">
    <p className="fw-notice">Live AI guidance is unavailable. This is a rules-based product guide, not an AI-generated answer or legal advice. It records your question and provides general guidance for the topic you select; it does not interpret arbitrary questions or perform actions.</p>
    <p>Only you can access this history. Do not include passwords, identification numbers or other unnecessary personal details.</p>
    <button className="fw-secondary" disabled={busy} onClick={() => void load(null)}>New conversation</button>
    <button className="fw-secondary" disabled={busy} onClick={() => void load(thread)}>Reload conversation</button>
    {!!data?.threads.length && <details><summary>Recent conversations</summary>{data.threads.map((item, index) => <button key={item.id} className="fw-secondary" disabled={busy} onClick={() => void load(item.id)}>Conversation {index + 1} · {new Date(item.updatedAt).toLocaleString()}</button>)}</details>}
    {busy && <p role="status">Loading or saving guidance…</p>}{error && <p role="alert">{error}</p>}
    <div aria-label="Conversation history">{data?.turns.map(turn => <article className="fw-list-card" key={turn.ordinal}>
      <h3>Your question</h3><p>{turn.question}</p><h4>Rules-based guidance · {turn.topic}</h4><p>{turn.response.text}</p>
      <p>Source: {turn.response.source} · {turn.response.sourceVersion}</p>
      {turn.response.context && <p>Saved context at the time of this reply: offer revision {turn.response.context.version}, {turn.response.context.openQuestions} open clarification questions. <Link href={`/app/agreement?offerId=${turn.response.context.offerId}`}>Review the current authorized offer</Link></p>}
      <Link className="fw-secondary" href={turn.response.destination}>Open related workspace</Link><small>No action has been taken on your behalf.</small>
    </article>)}</div>
    {data?.turns.length === 0 && <p>No messages in this conversation yet.</p>}
    <form onSubmit={event => void send(event)}><fieldset disabled={busy || data?.turns.length === 100}>
      <label className="fw-field">Guidance topic<select value={topic} onChange={event => setTopic(event.target.value)}><option value="offer">Offer terms</option><option value="agreement">Agreements</option><option value="evidence">Document evidence</option><option value="passport">Work Passport</option><option value="opportunities">Opportunity matching</option></select></label>
      <label className="fw-field">Saved offer ID (optional)<input value={offerId} onChange={event => setOfferId(event.target.value)} maxLength={36} /></label>
      <label className="fw-field">Your question<textarea required maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} /></label>
      <button className="fw-primary" disabled={!question.trim()}>Save question and get guidance</button>
    </fieldset></form>
    {data?.turns.length === 100 && <p>This conversation has reached 100 messages. Start a new conversation to continue.</p>}
  </section>;
}

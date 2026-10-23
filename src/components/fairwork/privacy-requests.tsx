"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { privacyList, privacyRequest, type PrivacyRequest } from "@/features/identity/privacy-schema";
const terminal = new Set(["fulfilled", "declined", "withdrawn"]);
const label = (value: string) => value.replaceAll("_", " ");
export function PrivacyRequests({ operator = false }: { operator?: boolean }) {
 const endpoint = operator ? "/api/v1/operator/privacy-requests" : "/api/v1/privacy-requests";
 const [items, setItems] = useState<PrivacyRequest[] | null>(null), [cursor, setCursor] = useState<string | null>(null);
 const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
 const keys = useRef(new Map<string, string>());
 useEffect(() => {
  let active = true;
  appRequest(endpoint).then(raw => { const page = privacyList.parse(raw); if (active) { setItems(page.items); setCursor(page.nextCursor); } })
   .catch(e => { if (active) { setItems(null); setError(e.message); } });
  return () => { active = false; };
 }, [endpoint]);
 async function refresh(next: string | null = null) {
  setBusy(true); setError(""); setItems(null); setCursor(null);
  try { const page = privacyList.parse(await appRequest(endpoint + (next ? `?cursor=${next}` : ""))); setItems(page.items); setCursor(page.nextCursor); }
  catch (e) { setError(e instanceof Error ? e.message : "Privacy requests are unavailable."); }
  finally { setBusy(false); }
 }
 async function command(body: unknown) {
  const fingerprint = JSON.stringify(body); let key = keys.current.get(fingerprint);
  if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
  privacyRequest.parse(await appRequest(endpoint, body, key));
 }
 async function submit(event: FormEvent<HTMLFormElement>, item?: PrivacyRequest) {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  setBusy(true); setError(""); setMessage("");
  try {
   await command(item ? { operation: "review", requestId: item.requestId, expectedRevision: item.revision, status: data.get("status"), note: data.get("note"), evidenceRef: data.get("status") === "fulfilled" ? data.get("evidenceRef") : null }
    : { operation: "create", kind: data.get("kind"), scope: data.get("scope") });
   form.reset(); setMessage(item ? "Review event recorded. This action does not execute an export or deletion." : "Privacy request saved for manual review. Your account and records have not been changed.");
   await refresh();
  } catch (e) { setItems(null); setError(e instanceof Error ? e.message : "Unable to save privacy request."); }
  finally { setBusy(false); }
 }
 async function withdraw(item: PrivacyRequest) {
  setBusy(true); setError(""); setMessage("");
  try { await command({ operation: "withdraw", requestId: item.requestId, expectedRevision: item.revision }); setMessage("Request withdrawn; its audit history is retained."); await refresh(); }
  catch (e) { setItems(null); setError(e instanceof Error ? e.message : "Unable to withdraw request."); }
  finally { setBusy(false); }
 }
 return <section className="fw-list-card" aria-label={operator ? "Privacy review queue" : "Privacy requests"}>
  <h3>{operator ? "Privacy review queue" : "Privacy requests"}</h3>
  <p>Access, correction, deactivation and deletion requests require manual review. Submitting a request does not export data, deactivate your account or erase records. Audit and shared-record retention must be reviewed separately.</p>
  {operator ? <p>Only your assigned privacy capability and verified authenticator session permit review. Do not mark fulfilled until the approved manual procedure is complete. Record a non-sensitive internal reference, never the exported data or a download link.</p> : <form onSubmit={event => void submit(event)}>
   <label className="fw-field">Privacy request type<select name="kind"><option value="access">Access my information</option><option value="correction">Correct my information</option><option value="deactivation">Request account deactivation</option><option value="deletion">Request deletion review</option></select></label>
   <label className="fw-field">Request scope<textarea name="scope" required maxLength={500} /></label>
   <p>Describe the records or issue briefly. Do not include passwords, identity documents or sensitive employment details. Your request is visible to you and authorized privacy reviewers.</p>
   <button className="fw-secondary" disabled={busy}>Submit privacy request</button>
  </form>}
  {!items && !error && <p role="status">Loading privacy requests…</p>}
  {items?.length === 0 && <p>No privacy requests to display.</p>}
  {items?.map(item => <article className="fw-question-card" key={item.requestId}>
   <strong>{label(item.kind)} request · {label(item.status)}</strong><p>{item.scope}</p>
   <p>Submitted {new Date(item.createdAt).toLocaleString()} · revision {item.revision}</p>
   <details><summary>Request audit timeline</summary><p style={{ overflowWrap: "anywhere" }}>Reference: {item.requestId}</p><p>Received {new Date(item.createdAt).toLocaleString()}</p>{item.history.map(entry => <div key={entry.revision}><strong>{label(entry.status)} · revision {entry.revision}</strong><p>{entry.note}</p><p>{new Date(entry.recordedAt).toLocaleString()}</p>{entry.evidenceRef && <p>Manual completion reference: {entry.evidenceRef}</p>}</div>)}</details>
   {!terminal.has(item.status) && item.revision < 20 && (operator ? <form onSubmit={event => void submit(event, item)}>
    <label className="fw-field">Review status<select name="status" defaultValue={item.revision === 19 ? "declined" : "in_review"}><option value="in_review" disabled={item.revision === 19}>In review</option><option value="needs_information" disabled={item.revision === 19}>Needs information</option><option value="declined">Declined</option><option value="fulfilled" disabled={item.revision === 0}>Manual fulfillment completed</option></select></label>
    <label className="fw-field">Review note<textarea name="note" required maxLength={500} /></label>
    <label className="fw-field">Manual completion reference (required for fulfilled)<input name="evidenceRef" maxLength={200} /></label>
    <button className="fw-secondary" disabled={busy}>Record privacy review</button>
   </form> : <button className="fw-secondary" disabled={busy} onClick={() => void withdraw(item)}>Withdraw this request</button>)}
  </article>)}
  <button className="fw-secondary" disabled={busy} onClick={() => void refresh()}>Refresh privacy requests</button>
  {cursor && <button className="fw-secondary" disabled={busy} onClick={() => void refresh(cursor)}>Next privacy requests</button>}
  {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
 </section>;
}

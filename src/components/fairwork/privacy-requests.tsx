"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { privacyList, privacyRequest, type PrivacyRequest } from "@/features/identity/privacy-schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
const terminal = new Set(["fulfilled", "declined", "withdrawn"]);
export function PrivacyRequests({ operator = false }: { operator?: boolean }) {
 const { t } = useI18n();
 const label = (value: string) => { const key = `pv.w.${value}`; const text = t(key as MessageKey); return text === key ? value.replaceAll("_", " ") : text; };
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
  catch (e) { setError(e instanceof Error ? e.message : t("pv.unavailable")); }
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
   form.reset(); setMessage(item ? t("pv.reviewRecorded") : t("pv.saved"));
   await refresh();
  } catch (e) { setItems(null); setError(e instanceof Error ? e.message : t("pv.saveFail")); }
  finally { setBusy(false); }
 }
 async function withdraw(item: PrivacyRequest) {
  setBusy(true); setError(""); setMessage("");
  try { await command({ operation: "withdraw", requestId: item.requestId, expectedRevision: item.revision }); setMessage(t("pv.withdrawn")); await refresh(); }
  catch (e) { setItems(null); setError(e instanceof Error ? e.message : t("pv.withdrawFail")); }
  finally { setBusy(false); }
 }
 return <section className="fw-list-card" aria-label={operator ? t("pv.queue") : t("pv.title")}>
  <h3>{operator ? t("pv.queue") : t("pv.title")}</h3>
  <p>{t("pv.intro")}</p>
  {operator ? <p>{t("pv.operatorNote")}</p> : <form onSubmit={event => void submit(event)}>
   <label className="fw-field">{t("pv.kind")}<select name="kind"><option value="access">{t("pv.k.access")}</option><option value="correction">{t("pv.k.correction")}</option><option value="deactivation">{t("pv.k.deactivation")}</option><option value="deletion">{t("pv.k.deletion")}</option></select></label>
   <label className="fw-field">{t("pv.scope")}<textarea name="scope" required maxLength={500} /></label>
   <p>{t("pv.scopeNote")}</p>
   <button className="fw-secondary" disabled={busy}>{t("pv.submit")}</button>
  </form>}
  {!items && !error && <p role="status">{t("pv.loading")}</p>}
  {items?.length === 0 && <p>{t("pv.none")}</p>}
  {items?.map(item => <article className="fw-question-card" key={item.requestId}>
   <strong>{t("pv.itemTitle", { kind: label(item.kind), status: label(item.status) })}</strong><p>{item.scope}</p>
   <p>{t("pv.submitted", { date: new Date(item.createdAt).toLocaleString(), revision: item.revision })}</p>
   <details><summary>{t("pv.timeline")}</summary><p style={{ overflowWrap: "anywhere" }}>{t("pv.reference", { id: item.requestId })}</p><p>{t("pv.received", { date: new Date(item.createdAt).toLocaleString() })}</p>{item.history.map(entry => <div key={entry.revision}><strong>{t("pv.entryTitle", { status: label(entry.status), revision: entry.revision })}</strong><p>{entry.note}</p><p>{new Date(entry.recordedAt).toLocaleString()}</p>{entry.evidenceRef && <p>{t("pv.completionRef", { ref: entry.evidenceRef })}</p>}</div>)}</details>
   {!terminal.has(item.status) && item.revision < 20 && (operator ? <form onSubmit={event => void submit(event, item)}>
    <label className="fw-field">{t("pv.reviewStatus")}<select name="status" defaultValue={item.revision === 19 ? "declined" : "in_review"}><option value="in_review" disabled={item.revision === 19}>{t("pv.st.in_review")}</option><option value="needs_information" disabled={item.revision === 19}>{t("pv.st.needs_information")}</option><option value="declined">{t("pv.st.declined")}</option><option value="fulfilled" disabled={item.revision === 0}>{t("pv.st.fulfilled")}</option></select></label>
    <label className="fw-field">{t("pv.reviewNote")}<textarea name="note" required maxLength={500} /></label>
    <label className="fw-field">{t("pv.evidenceRef")}<input name="evidenceRef" maxLength={200} /></label>
    <button className="fw-secondary" disabled={busy}>{t("pv.record")}</button>
   </form> : <button className="fw-secondary" disabled={busy} onClick={() => void withdraw(item)}>{t("pv.withdraw")}</button>)}
  </article>)}
  <button className="fw-secondary" disabled={busy} onClick={() => void refresh()}>{t("pv.refresh")}</button>
  {cursor && <button className="fw-secondary" disabled={busy} onClick={() => void refresh(cursor)}>{t("pv.next")}</button>}
  {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
 </section>;
}

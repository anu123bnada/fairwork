"use client";
import { useEffect, useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { reportQueue } from "@/features/reports/schema";

type Item = ReturnType<typeof reportQueue.parse>["items"][number];
const EVENTS = [["reviewing", "Start reviewing"], ["needs_information", "Ask the reporter for more information"], ["closed_actioned", "Close: action was taken"], ["closed_no_action", "Close: no action"]] as const;

// Reviewer queue (capability review_operator with a second factor). It never shows who reported. Notes are written back to the reporter, so keep them factual.
export function ReportQueue() {
  const [items, setItems] = useState<Item[] | null>(null), [status, setStatus] = useState<"open" | "closed">("open"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({}), keys = useRef(new Map<string, string>());
  useEffect(() => {
    let active = true;
    appRequest(`/api/v1/operator/reports?status=${status}`).then(raw => { if (active) { setItems(reportQueue.parse(raw).items); setError(""); } }).catch(caught => { if (active) { setItems(null); setError(caught instanceof Error ? caught.message : "The queue could not be loaded."); } });
    return () => { active = false; };
  }, [status]);
  async function act(item: Item, event: (typeof EVENTS)[number][0]) {
    setBusy(true); setError("");
    try {
      const body = { reportId: item.reportId, expectedRevision: item.revision, event, note: (notes[item.reportId] ?? "").trim() || null };
      const fingerprint = JSON.stringify(body); let key = keys.current.get(fingerprint); if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
      await appRequest("/api/v1/operator/reports", body, key);
      setNotes(previous => ({ ...previous, [item.reportId]: "" }));
      setItems(reportQueue.parse(await appRequest(`/api/v1/operator/reports?status=${status}`)).items);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "That did not work."); }
    finally { setBusy(false); }
  }
  return <section className="fw-list-card" aria-label="Report review queue">
    <p>Reports are private. The reporter is not shown to you, the subject is never told, and ORYQEN makes no public accusation. Notes you write are shown to the reporter.</p>
    <div role="group" aria-label="Queue view">{(["open", "closed"] as const).map(value => <button key={value} className="fw-secondary" aria-pressed={status === value} disabled={busy} onClick={() => { setItems(null); setStatus(value); }}>{value === "open" ? "Open reports" : "Closed reports"}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    {items?.length === 0 && <p>No reports in this view.</p>}
    {items?.map(item => <article className="fw-question-card" key={item.reportId}>
      <strong>{item.subjectLabel}</strong> · {item.subjectKind.replace("_", " ")} · {item.category.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")}
      <p>{item.details}</p><small>Filed {new Date(item.createdAt).toLocaleString()}</small>
      {status === "open" && (item.own ? <p role="note">This is your own report; another reviewer must handle it.</p> : <>
        <label className="fw-field">Note (required to close or ask for information)<input maxLength={500} value={notes[item.reportId] ?? ""} onChange={event => setNotes(previous => ({ ...previous, [item.reportId]: event.target.value }))} /></label>
        {EVENTS.map(([event, label]) => <button key={event} className="fw-secondary" disabled={busy || (event !== "reviewing" && !(notes[item.reportId] ?? "").trim())} onClick={() => void act(item, event)}>{label}</button>)}
      </>)}
    </article>)}
  </section>;
}

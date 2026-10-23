"use client";
import { useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { offerHistorySchema, type OfferHistory } from "@/features/offer/history-schema";

export function OfferHistoryPanel({ offerId }: { offerId: string }) {
  const [data, setData] = useState<OfferHistory | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0);
  async function load(beforeVersion: number | null = null) {
    const current = ++sequence.current; setBusy(true); setError(""); setData(null);
    try {
      const result = offerHistorySchema.parse(await appRequest(`/api/v1/offers/history?offerId=${offerId}${beforeVersion ? `&beforeVersion=${beforeVersion}` : ""}`));
      if (result.offerId !== offerId) throw new Error("Unexpected offer history.");
      if (sequence.current === current) setData(result);
    } catch { if (sequence.current === current) setError("History is unavailable. Check your access and connection, then retry."); }
    finally { if (sequence.current === current) setBusy(false); }
  }
  return <details className="fw-list-card" onToggle={event => {
    if (event.currentTarget.open) void load();
    else { sequence.current++; setData(null); setBusy(false); setError(""); }
  }}>
    <summary>Saved revision history</summary>
    <p>Read-only saved terms. Historical revisions are not current agreement confirmation or verification.</p>
    {busy && <p role="status">Loading saved history…</p>}{error && <p role="alert">{error}</p>}
    {data?.items.map(item => <article key={item.version} aria-label={`Saved revision ${item.version}`}>
      <h4>Revision {item.version}</h4><p>{new Date(item.recordedAt).toLocaleString()}</p>
      <dl>{Object.entries(item.snapshot).map(([field, value]) => <div key={field}><dt>{field.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl>
      {item.changes.length > 0 && <details><summary>Changes in this revision</summary><ul>{item.changes.map(change => <li key={change.field}>{change.field}: {String(change.previous ?? "Not stated")} → {String(change.current ?? "Not stated")}</li>)}</ul></details>}
    </article>)}
    {data?.items.length === 0 && <p>No earlier accessible revisions.</p>}
    <button className="fw-secondary" disabled={busy} onClick={() => void load()}>Reload latest history</button>
    {data?.nextCursor && <button className="fw-secondary" disabled={busy} onClick={() => void load(data.nextCursor)}>Earlier revisions</button>}
  </details>;
}

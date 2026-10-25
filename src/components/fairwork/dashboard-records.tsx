"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { workListSchema, type WorkList } from "@/features/work/schema";

export function DashboardRecords() {
  const [records, setRecords] = useState<WorkList | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/work-records").then(raw => {
      const parsed = workListSchema.parse(raw);
      if (active) setRecords(parsed);
    }).catch(() => {
      if (active) { setRecords(null); setError(true); }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [attempt]);

  return <section className="fw-list-card" aria-label="Dashboard work records">
    <h3>Your work records</h3>
    <p>Private saved records. Open a record to inspect its evidence and current verification basis.</p>
    {busy && <p role="status">Loading work records…</p>}
    {error && <p role="alert">Work records could not be loaded. Check your connection and retry.</p>}
    {!busy && records?.items.length === 0 && <p>No agreement-backed work records yet. Start with an independently confirmed agreement.</p>}
    {records?.items.slice(0, 3).map(item => <div className="fw-list-row" key={item.workId}>
      <span><strong>{item.periodStart} – {item.periodEnd}</strong><br />{item.hours} hours · {item.state === "verified" ? "Counterpart verified; inspect current eligibility" : item.state.replaceAll("_", " ")}</span>
      <Link className="fw-small-action" href={`/app/work-record?workId=${item.workId}`}>Open work record</Link>
    </div>)}
    {records && (records.items.length > 3 || records.nextCursor) && <p>Showing up to three loaded records. Open work records for the full list.</p>}
    <button className="fw-secondary" disabled={busy} onClick={() => { setBusy(true); setError(false); setRecords(null); setAttempt(value => value + 1); }}>Refresh work records</button>
    <Link className="fw-secondary" href="/app/work-record">Open all work records</Link>
    <Link className="fw-secondary" href="/app/agreement-workflow">Open a saved agreement</Link>
  </section>;
}

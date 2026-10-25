"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { analysisList, analysisReceipt, type AnalysisList } from "@/features/offer/analysis-history-schema";

export function AnalysisHistory({ offerId, version, termHash }: { offerId: string; version: number; termHash: string }) {
  const [list, setList] = useState<AnalysisList | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const key = useRef<string | null>(null), saving = useRef(false);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { setList(analysisList.parse(await appRequest(`/api/v1/offers/analyses?offerId=${encodeURIComponent(offerId)}`))); }
    catch { setList(null); setError("Saved analyses could not be loaded. Retry when connected."); }
    finally { setBusy(false); }
  }, [offerId]);
  useEffect(() => {
    let active = true;
    appRequest(`/api/v1/offers/analyses?offerId=${encodeURIComponent(offerId)}`)
      .then(raw => { if (active) setList(analysisList.parse(raw)); })
      .catch(() => { if (active) setError("Saved analyses could not be loaded. Retry when connected."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [offerId, version, termHash]);
  async function save() {
    if (saving.current) return; saving.current = true; setBusy(true); setError(""); setNotice("");
    try {
      key.current ??= crypto.randomUUID();
      analysisReceipt.parse(await appRequest("/api/v1/offers/analyses", { offerId, idempotencyKey: key.current }));
      key.current = null; setNotice("Analysis saved to your private history."); await load();
    } catch { setError("The analysis could not be saved. Retry; the same request is reused so it is not duplicated."); setBusy(false); }
    finally { saving.current = false; }
  }
  return <section aria-label="Saved analysis history">
    <h4>Saved analysis history</h4>
    <p>Save a snapshot of this rules-based analysis for your records. It is computed on the server from the current saved terms, kept privately, and never edited. A snapshot is not verification of the employer.</p>
    <button type="button" className="fw-secondary" disabled={busy} onClick={() => void save()}>Save this analysis</button>
    {error && !list && <button type="button" className="fw-secondary" disabled={busy} onClick={() => void load()}>Retry loading</button>}
    {busy && <p role="status">Loading or saving…</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {list?.items.length === 0 && <p>No saved analyses for this offer yet.</p>}
    <ul aria-label="Saved analyses">{list?.items.map(item => <li key={item.id}>
      <strong>{item.score}/100</strong> · saved {new Date(item.savedAt).toLocaleString()} · terms revision {item.offerVersion} · engine {item.engine}
      {" "}· {item.offerVersion === version && item.termHash === termHash ? "matches the current terms" : "earlier terms, since changed"}
      <br /><small>{item.result.statedCount} stated · {item.result.missingCount} missing · {item.result.uncertainCount} uncertain · {item.result.concernCount} explicit concerns</small>
    </li>)}</ul>
  </section>;
}

"use client";
import { useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { offerHistorySchema, type OfferHistory } from "@/features/offer/history-schema";
import { useI18n } from "@/i18n/use-i18n";

export function OfferHistoryPanel({ offerId }: { offerId: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<OfferHistory | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0);
  async function load(beforeVersion: number | null = null) {
    const current = ++sequence.current; setBusy(true); setError(""); setData(null);
    try {
      const result = offerHistorySchema.parse(await appRequest(`/api/v1/offers/history?offerId=${offerId}${beforeVersion ? `&beforeVersion=${beforeVersion}` : ""}`));
      if (result.offerId !== offerId) throw new Error(t("oh.unexpected"));
      if (sequence.current === current) setData(result);
    } catch { if (sequence.current === current) setError(t("oh.error")); }
    finally { if (sequence.current === current) setBusy(false); }
  }
  return <details className="fw-list-card" onToggle={event => {
    if (event.currentTarget.open) void load();
    else { sequence.current++; setData(null); setBusy(false); setError(""); }
  }}>
    <summary>{t("oh.summary")}</summary>
    <p>{t("oh.intro")}</p>
    {busy && <p role="status">{t("oh.loading")}</p>}{error && <p role="alert">{error}</p>}
    {data?.items.map(item => <article key={item.version} aria-label={t("oh.revAria", { version: item.version })}>
      <h4>{t("oh.rev", { version: item.version })}</h4><p>{new Date(item.recordedAt).toLocaleString()}</p>
      <dl>{Object.entries(item.snapshot).map(([field, value]) => <div key={field}><dt>{field.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl>
      {item.changes.length > 0 && <details><summary>{t("oh.changes")}</summary><ul>{item.changes.map(change => <li key={change.field}>{change.field}: {String(change.previous ?? t("oc.notStated"))} → {String(change.current ?? t("oc.notStated"))}</li>)}</ul></details>}
    </article>)}
    {data?.items.length === 0 && <p>{t("oh.none")}</p>}
    <button className="fw-secondary" disabled={busy} onClick={() => void load()}>{t("oh.reload")}</button>
    {data?.nextCursor && <button className="fw-secondary" disabled={busy} onClick={() => void load(data.nextCursor)}>{t("oh.earlier")}</button>}
  </details>;
}

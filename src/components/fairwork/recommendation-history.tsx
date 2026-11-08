"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { bcp47 } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { appRequest } from "@/features/authority/client";
import { recommendationHistoryList, type RecommendationHistoryEntry } from "@/features/opportunities/history";

// The person's private record of listings they saved and how each compared with their preferences at that moment (module 3). It loads only when opened.
export function RecommendationHistory({ refreshKey }: { refreshKey: number }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false), [items, setItems] = useState<RecommendationHistoryEntry[] | null>(null), [failed, setFailed] = useState(false);
  const when = (value: string) => Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleDateString(bcp47(locale), { year: "numeric", month: "short", day: "numeric" });
  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      try { const value = recommendationHistoryList.parse(await appRequest("/api/v1/opportunities/history")); if (live) { setItems(value.items); setFailed(false); } }
      catch { if (live) setFailed(true); }
    })();
    return () => { live = false; };
  }, [open, refreshKey]);
  async function remove(entryId: string) {
    try { await appRequest("/api/v1/opportunities/history/remove", { entryId }); setItems(current => current?.filter(item => item.entryId !== entryId) ?? null); setFailed(false); }
    catch { setFailed(true); }
  }
  return <details className="fw-research-history" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t("rec.title")}</summary>
    <p>{t("rec.intro")}</p>
    {failed && <p role="alert">{t("rec.error")}</p>}
    {items && !items.length && !failed && <p>{t("rec.empty")}</p>}
    {items?.map(item => <article className="fw-question-card" key={item.entryId}>
      <h4>{item.listingTitle}{item.companyName ? ` · ${item.companyName}` : ""}</h4>
      <p>{t("rec.when", { date: when(item.createdAt) })}</p>
      {item.reasons.length === 0 ? <p>{t("rec.noPrefs")}</p> : <ul>{item.reasons.map(reason => <li key={reason.id}>{t(`rec.c.${reason.id}` as MessageKey)}: {t(`rec.o.${reason.outcome}` as MessageKey)}</li>)}</ul>}
      <button type="button" className="fw-secondary" onClick={() => void remove(item.entryId)}>{t("rec.delete")}</button>
    </article>)}
  </details>;
}

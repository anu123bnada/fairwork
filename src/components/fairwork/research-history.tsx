"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { bcp47 } from "@/i18n";
import { appRequest } from "@/features/authority/client";
import { researchHistoryList, type ResearchHistoryEntry } from "@/features/research/history";

// The person's private record of earlier company searches (module 02). It loads only when opened, so it adds no reads to a screen that is merely visited.
export function ResearchHistory({ refreshKey, onSearchAgain }: { refreshKey: number; onSearchAgain: (name: string, country: string | null) => void }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false), [items, setItems] = useState<ResearchHistoryEntry[] | null>(null), [failed, setFailed] = useState(false);
  const when = (value: string) => Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleDateString(bcp47(locale), { year: "numeric", month: "short", day: "numeric" });
  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      try { const value = researchHistoryList.parse(await appRequest("/api/v1/research/history")); if (live) { setItems(value.items); setFailed(false); } }
      catch { if (live) setFailed(true); }
    })();
    return () => { live = false; };
  }, [open, refreshKey]);
  async function remove(entryId: string) {
    try { await appRequest("/api/v1/research/history/remove", { entryId }); setItems(current => current?.filter(item => item.entryId !== entryId) ?? null); setFailed(false); }
    catch { setFailed(true); }
  }
  return <details className="fw-research-history" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t("rh.title")}</summary>
    <p>{t("rh.intro")}</p>
    {failed && <p role="alert">{t("rh.error")}</p>}
    {items && !items.length && !failed && <p>{t("rh.empty")}</p>}
    {items?.map(item => <article className="fw-question-card" key={item.entryId}>
      <h4>{item.queryName}{item.queryCountry ? ` · ${item.queryCountry}` : ""}</h4>
      <p>{t("rh.line", { matches: item.totalMatches, match: t(`rh.m.${item.topMatch}` as const) })}{item.topName && item.topLei ? ` — ${t("rh.best", { name: item.topName, lei: item.topLei })}` : ""}</p>
      <p>{t("rh.when", { date: when(item.retrievedAt), source: item.source })}</p>
      <button type="button" className="fw-secondary" onClick={() => onSearchAgain(item.queryName, item.queryCountry)}>{t("rh.again")}</button>
      <button type="button" className="fw-secondary" onClick={() => void remove(item.entryId)}>{t("rh.delete")}</button>
    </article>)}
  </details>;
}

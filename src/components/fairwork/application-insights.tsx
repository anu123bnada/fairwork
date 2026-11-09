"use client";
import { useMemo } from "react";
import { FOLLOW_UP_AFTER_DAYS, computeInsights } from "@/features/records/insights";
import type { RecordSummary } from "@/features/records/schema";
import { useI18n } from "@/i18n/use-i18n";
import "./records.css";

// Follow-up suggestions and outcome counts for the person's own applications. Fixed rules over their own list; no AI, no benchmarks, and ORYQEN never contacts an employer.
export function ApplicationInsights({ items }: { items: readonly RecordSummary[] }) {
  const { t } = useI18n();
  const insights = useMemo(() => computeInsights(items, new Date().toISOString().slice(0, 10)), [items]);
  if (items.length === 0) return null;
  return <section className="oq-rec-group" aria-label={t("ins.aria")}>
    <h3>{t("ins.title")}</h3>
    <p>{t("ins.outcomes", { applied: insights.applied, interviews: insights.reachedInterview, offers: insights.offers, rejected: insights.rejected })}</p>
    {insights.followUps.length === 0 ? <p>{t("ins.none")}</p> : <ul aria-label={t("ins.followAria")}>{insights.followUps.map(item => <li key={item.id}>
      <strong>{item.title}</strong>: {item.reason === "overdue_next_step" ? t("ins.overdue", { days: item.days }) : t("ins.noReply", { days: item.days })}
    </li>)}</ul>}
    <p className="fw-notice">{t("ins.note", { days: FOLLOW_UP_AFTER_DAYS })}</p>
  </section>;
}

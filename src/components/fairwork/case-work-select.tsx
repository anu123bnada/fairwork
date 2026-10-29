"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { workListSchema } from "@/features/work/schema";
import { useI18n } from "@/i18n/use-i18n";

type Item = { workId: string; version: number; state: string; hours: string; periodStart: string; periodEnd: string };

// Choose which of your own work records a concern is about, instead of pasting its id.
// Drafts are left out: a concern is raised about a record that was submitted. If the list cannot be read,
// the original field is shown so the screen keeps working (and a record opened from a link stays selected).
export function CaseWorkSelect({ value, onChange, disabled, fallback }: { value: string; onChange: (workId: string) => void; disabled: boolean; fallback: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Item[] | null | "failed">(null);
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/work-records").then(raw => { const parsed = workListSchema.safeParse(raw); if (active) setItems(parsed.success ? parsed.data.items.filter(item => item.state !== "draft") : "failed"); })
      .catch(() => { if (active) setItems("failed"); });
    return () => { active = false; };
  }, []);
  if (items === null) return <p role="status" className="fw-notice">{t("cws.loading")}</p>;
  if (items === "failed") return <>{fallback}</>;
  if (!items.length && !value) return <p className="fw-notice">{t("cws.none")} <Link href="/app/work-record">{t("pp.viewRecords")}</Link></p>;
  const known = items.some(item => item.workId === value);
  return <label className="fw-field">{t("cws.label")}
    <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required>
      <option value="">{t("cws.choose")}</option>
      {value && !known && <option value={value}>{t("cws.linked")}</option>}
      {items.map(item => <option key={item.workId} value={item.workId}>{t("cws.option", { start: item.periodStart, end: item.periodEnd, hours: item.hours, state: item.state.replaceAll("_", " ") })}</option>)}
    </select>
  </label>;
}

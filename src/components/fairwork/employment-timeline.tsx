"use client";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { employmentPage } from "@/features/work/employment-schema";
import { workListSchema } from "@/features/work/schema";
import { buildTimeline, type TimelineEntry } from "@/features/work/timeline";
import { bcp47, type MessageKey } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";

// A read-only, chronological view of the person's own self-reported jobs and work records. It adds no data and verifies nothing.
export function EmploymentTimeline() {
  const { t, locale } = useI18n();
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null), [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([appRequest("/api/v1/me/employment-history"), appRequest("/api/v1/work-records")]).then(([history, work]) => {
      if (active) setEntries(buildTimeline(employmentPage.parse(history).items, workListSchema.parse(work).items));
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const when = (value: string) => new Date(value.length === 7 ? `${value}-01` : value).toLocaleDateString(bcp47(locale), value.length === 7 ? { year: "numeric", month: "short" } : { year: "numeric", month: "short", day: "numeric" });
  return <section className="fw-list-card" aria-label={t("tl.title")}>
    <h3>{t("tl.title")}</h3>
    <p>{t("tl.intro")}</p>
    {error && <p role="alert">{t("tl.error")}</p>}
    {entries?.length === 0 && <p>{t("tl.empty")}</p>}
    {entries && entries.length > 0 && <ol>{entries.map(entry => <li key={`${entry.kind}:${entry.id}`}>
      <strong>{when(entry.start)} – {entry.end ? when(entry.end) : t("tl.present")}</strong>{" "}
      {entry.kind === "self_reported"
        ? <>{entry.role} · {entry.employer} <small>({t("tl.selfReported")})</small></>
        : <>{t("tl.workRecord", { hours: entry.hours })} <small>({t(`tl.state.${entry.state}` as MessageKey)})</small></>}
    </li>)}</ol>}
  </section>;
}

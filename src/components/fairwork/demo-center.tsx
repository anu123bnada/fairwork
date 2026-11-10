"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DEMO_MARK, kindsToCheck, sampleRecordBodies } from "@/features/demo/sample-records";
import { listRecordsOf, removeRecordById, saveRecordBody } from "@/features/records/client";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import type { RecordKind } from "@/features/records/schema";
import "./records.css";

const journey: [string, MessageKey, RecordKind | null][] = [["/app/settings", "dj.s1", null], ["/app/career-explorer", "dj.s2", null], ["/app/career-explorer", "dj.s3", "roadmap"], ["/app/opportunities", "dj.s4", null], ["/app/applications", "dj.s5", "application"], ["/app/interviews", "dj.s6", null], ["/app/add-offer", "dj.s7", null], ["/app/agreement-workflow", "dj.s8", null], ["/app/work-record", "dj.s9", null], ["/app/passport", "dj.s10", null]];
const worker: [string, string][] = [["/app/career-explorer", "Career explorer"], ["/app/career-assistant", "Career assistant"], ["/app/cv", "CV Builder"], ["/app/cover-letter", "Cover letter"], ["/app/portfolio", "Portfolio"], ["/app/opportunities", "Job opportunities"], ["/app/applications", "Application tracker"], ["/app/interviews", "Interviews"], ["/app/workroom", "Workroom"], ["/app/employers-demo", "Sample employers"], ["/app/add-offer", "Add a job offer (use the sample offer button)"]];
const organization: [string, string][] = [["/app/opportunities", "Publish and manage listings (approved representatives)"], ["/app/applicants", "Applicants and candidate review"], ["/app/settings", "Organization requests and team (Settings)"]];

// Demo center: says plainly what is real and what is sample, loads and removes sample records in the person's OWN account only, and gives role-based navigation.
export function DemoCenter() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [counts, setCounts] = useState<Partial<Record<RecordKind, number | "error">>>({});
  const refreshCounts = useCallback(async () => {
    const next: Partial<Record<RecordKind, number | "error">> = {};
    for (const kind of ["roadmap", "application"] as const) { try { next[kind] = (await listRecordsOf(kind)).length; } catch { next[kind] = "error"; } }
    setCounts(next);
  }, []);
  useEffect(() => {
    let live = true;
    (async () => { const next: Partial<Record<RecordKind, number | "error">> = {}; for (const kind of ["roadmap", "application"] as const) { try { next[kind] = (await listRecordsOf(kind)).length; } catch { next[kind] = "error"; } } if (live) setCounts(next); })();
    return () => { live = false; };
  }, []);
  async function load() {
    setBusy(true); setMessage(""); setError("");
    try {
      const existing = new Set<string>();
      for (const kind of kindsToCheck) for (const item of await listRecordsOf(kind)) existing.add(`${kind}:${item.title}`);
      let created = 0, skipped = 0;
      for (const body of sampleRecordBodies()) {
        if (existing.has(`${body.kind}:${body.title}`)) { skipped += 1; continue; }
        await saveRecordBody(body); created += 1;
      }
      setMessage(t("dc.loaded", { created, skipped })); await refreshCounts();
    } catch { setError(t("dc.loadFailed")); } finally { setBusy(false); }
  }
  async function clear() {
    if (!window.confirm(t("dc.confirmClear"))) return;
    setBusy(true); setMessage(""); setError("");
    try {
      let removed = 0;
      for (const kind of kindsToCheck) for (const item of await listRecordsOf(kind)) if (item.title.endsWith(DEMO_MARK)) { await removeRecordById(item.id); removed += 1; }
      setMessage(t("dc.removed", { count: removed })); await refreshCounts();
    } catch { setError(t("dc.clearFailed")); } finally { setBusy(false); }
  }
  return <section className="oq-rec" aria-label={t("dc.aria")}>
    <p className="fw-notice">{t("dc.modeBody")}</p>
    <h3>{t("dc.sampleTitle")}</h3>
    <p>{t("dc.sampleBody")}</p>
    <div className="oq-rec-chips">
      <button className="fw-primary" disabled={busy} onClick={() => void load()}>{t("dc.load")}</button>
      <button className="fw-secondary" disabled={busy} onClick={() => void clear()}>{t("dc.clear")}</button>
    </div>
    {busy && <p role="status">{t("dc.working")}</p>}{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <h3>{t("dj.title")}</h3>
    <p>{t("dj.intro")}</p>
    <ol aria-label={t("dj.title")}>{journey.map(([href, key, kind]) => <li key={key}>{t(key)}{kind ? ` (${counts[kind] === undefined ? "…" : counts[kind] === "error" ? t("dj.countError") : t("dj.count", { count: Number(counts[kind]) })})` : ""} <Link href={href}>{t("dj.open")}</Link></li>)}</ol>
    <p className="fw-notice">{t("dj.note8")}</p>
    <h3>{t("dc.workerTitle")}</h3>
    <ul aria-label={t("dc.workerTitle")}>{worker.map(([href, label]) => <li key={href + label}><Link href={href}>{label}</Link></li>)}</ul>
    <h3>{t("dc.orgTitle")}</h3>
    <p>{t("dc.orgBody")}</p>
    <ul aria-label={t("dc.orgTitle")}>{organization.map(([href, label]) => <li key={href + label}><Link href={href}>{label}</Link></li>)}</ul>
    <h3>{t("dc.realTitle")}</h3>
    <table aria-label={t("dc.realTitle")}><thead><tr><th scope="col">{t("dc.colFeature")}</th><th scope="col">{t("dc.colKind")}</th></tr></thead><tbody>
      {(["dc.r1", "dc.r2", "dc.r3", "dc.r4", "dc.r5", "dc.r6"] as const).map(key => <tr key={key}><td>{t(`${key}.f` as never)}</td><td>{t(`${key}.k` as never)}</td></tr>)}
    </tbody></table>
    <h3>{t("dc.resetTitle")}</h3>
    <p>{t("dc.resetBody")}</p>
  </section>;
}

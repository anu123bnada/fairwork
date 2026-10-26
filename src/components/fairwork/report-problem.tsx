"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { reportCategories, reportInput, reportList, type reportSubjectKinds } from "@/features/reports/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

type Kind = (typeof reportSubjectKinds)[number];

// A private report about something the person met (a recruiter check, a listing). It goes to reviewers only; the subject is never told.
export function ReportProblem({ kind, subjectRef, subjectLabel }: { kind: Kind; subjectRef: string | null; subjectLabel: string }) {
  const { t } = useI18n();
  const [category, setCategory] = useState<(typeof reportCategories)[number]>("fee_request"), [details, setDetails] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false);
  const key = useRef<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      key.current ??= crypto.randomUUID();
      const body = reportInput.parse({ reportId: key.current, subjectKind: kind, subjectRef, subjectLabel, category, details, idempotencyKey: key.current });
      await appRequest("/api/v1/reports", body); setSent(true); setDetails(""); key.current = null;
    } catch (caught) { setError(caught instanceof ApiRequestError && caught.status === 429 ? t("rp.limit") : t("rp.failed")); }
    finally { setBusy(false); }
  }
  return <details className="fw-list-card"><summary>{t("rp.summary")}</summary>
    <p>{t("rp.intro")}</p>
    {sent ? <p role="status">{t("rp.sent")}</p> : <form onSubmit={event => void submit(event)} aria-label={t("rp.summary")}>
      <label className="fw-field">{t("rp.category")}<select value={category} onChange={event => setCategory(event.target.value as typeof category)}>{reportCategories.map(value => <option key={value} value={value}>{t(`rp.c.${value}` as MessageKey)}</option>)}</select></label>
      <label className="fw-field">{t("rp.details")}<textarea required minLength={10} maxLength={1000} value={details} onChange={event => setDetails(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="fw-secondary" disabled={busy || details.trim().length < 10}>{busy ? t("rp.sending") : t("rp.send")}</button>
    </form>}
  </details>;
}

// The person's own reports with what reviewers wrote back, and withdrawal while a report is still open.
export function MyReports() {
  const { t } = useI18n();
  const [items, setItems] = useState<ReturnType<typeof reportList.parse>["items"] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/reports").then(raw => { if (active) setItems(reportList.parse(raw).items); }).catch(() => { if (active) setError(t("rp.loadError")); });
    return () => { active = false; };
  }, [t]);
  async function withdraw(reportId: string) {
    setBusy(true); setError("");
    try { await appRequest("/api/v1/reports/withdraw", { reportId }); setItems(reportList.parse(await appRequest("/api/v1/reports")).items); } catch { setError(t("rp.loadError")); } finally { setBusy(false); }
  }
  const word = (status: string) => t(`rp.s.${status}` as MessageKey);
  return <section className="fw-list-card" aria-label={t("rp.mine")}>
    {error && <p role="alert">{error}</p>}
    {items?.length === 0 && <p>{t("rp.none")}</p>}
    {items?.map(item => <article className="fw-question-card" key={item.reportId}>
      <strong>{item.subjectLabel}</strong> · {t(`rp.c.${item.category}` as MessageKey)}
      <p>{item.details}</p>
      <p>{t("rp.status", { status: word(item.status) })}</p>
      <details><summary>{t("rp.history")}</summary><ol>{item.events.map((event, index) => <li key={index}>{word(event.event)} · {new Date(event.at).toLocaleString()}{event.note ? ` — ${event.note}` : ""}</li>)}</ol></details>
      {["received", "reviewing", "needs_information"].includes(item.status) && <button type="button" className="fw-secondary" disabled={busy} onClick={() => void withdraw(item.reportId)}>{t("rp.withdraw")}</button>}
    </article>)}
  </section>;
}

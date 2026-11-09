"use client";
import { useEffect, useState } from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { commandResult, dashboard, inbox, reviewStatuses, type Dashboard, type Inbox } from "@/features/applications/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

// Organization side: the listings this person published, how many applications each has, and a review list per listing. Applicants are shown only as the name and message they sent.
// Review statuses are an internal organization note; ORYQEN does not message the applicant and does not verify anyone.
export function ApplicantManagement() {
  const { t } = useI18n();
  const [board, setBoard] = useState<Dashboard | null>(null), [open, setOpen] = useState<Inbox | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      try { const result = dashboard.parse(await appRequest("/api/v1/applications?view=dashboard")); if (live) setBoard(result); }
      catch { if (live) setError(t("am.loadError")); }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, [t]);
  async function refreshBoard() { try { setBoard(dashboard.parse(await appRequest("/api/v1/applications?view=dashboard"))); } catch { setError(t("am.loadError")); } }
  async function show(listingId: string) {
    setBusy(true); setError("");
    try { setOpen(inbox.parse(await appRequest(`/api/v1/applications?listingId=${listingId}`))); } catch { setError(t("am.loadError")); } finally { setBusy(false); }
  }
  async function review(id: string, status: (typeof reviewStatuses)[number], revision: number) {
    if (!open) return;
    setBusy(true); setError("");
    try { commandResult.parse(await appRequest("/api/v1/applications", { action: "review", id, status, expectedRevision: revision })); await show(open.listingId); await refreshBoard(); }
    catch (caught) { setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("am.conflict") : t("am.reviewError")); await show(open.listingId); } finally { setBusy(false); }
  }

  if (open) return <section className="oq-rec" aria-label={t("am.aria")}>
    <button className="fw-secondary" disabled={busy} onClick={() => { setOpen(null); setError(""); }}>{t("am.back")}</button>
    <h3>{open.listingTitle}</h3>
    {busy && <p role="status">{t("am.loading")}</p>}{error && <p role="alert">{error}</p>}
    {open.items.length === 0 && !busy && <p>{t("am.noApplicants")}</p>}
    <ul className="oq-rec-list" aria-label={t("am.applicantsAria")}>{open.items.map(item => <li key={item.id}>
      <strong>{item.applicantName}</strong> · {t(`sub.s.${item.status}` as MessageKey)} · {new Date(item.createdAt).toLocaleDateString()}
      <p>{item.message || t("am.noMessage")}</p>
      {item.status !== "withdrawn" && <div className="oq-rec-chips">{reviewStatuses.map(status => <button key={status} className="fw-secondary" disabled={busy || item.status === status} aria-label={t("am.markAs", { name: item.applicantName, status: t(`sub.s.${status}` as MessageKey) })} onClick={() => void review(item.id, status, item.revision)}>{t(`sub.s.${status}` as MessageKey)}</button>)}</div>}
    </li>)}</ul>
    <p className="fw-notice">{t("am.privacy")}</p>
  </section>;

  return <section className="oq-rec" aria-label={t("am.aria")}>
    <p>{t("am.intro")}</p>
    {busy && <p role="status">{t("am.loading")}</p>}{error && <p role="alert">{error}</p>}
    {board && board.items.length === 0 && !busy && <p>{t("am.noListings")}</p>}
    <ul className="oq-rec-list" aria-label={t("am.listAria")}>{(board?.items ?? []).map(item => {
      const total = item.counts.submitted + item.counts.reviewing + item.counts.shortlisted + item.counts.declined + item.counts.withdrawn;
      return <li key={item.listingId}>
        <strong>{item.title}</strong> · {t(`am.ls.${item.status}` as MessageKey)} · {t("am.counts", { total, submitted: item.counts.submitted, shortlisted: item.counts.shortlisted })}
        <button className="fw-secondary" disabled={busy} onClick={() => void show(item.listingId)}>{t("am.view", { title: item.title })}</button>
      </li>;
    })}</ul>
    <p className="fw-notice">{t("am.privacy")}</p>
  </section>;
}

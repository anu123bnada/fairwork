"use client";
import { useEffect, useState } from "react";
import { applicantsOf, countsOf, initialOrgDemo, orgDemoListing, parseOrgDemo, reviewStates, VISITOR_ID, type OrgDemoState, type ReviewState } from "@/features/employers/org-demo";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

const storageKey = "oryqen.org-demo.v1";

// Organization sandbox (DEMO). Shows both sides of the applicant workflow with fictional applicants, on this device only. It does not call the real applicant API, is not tied to any
// organization, and nothing in it is verified. The real review screen is the one above it, which only an approved organization representative can use.
export function OrgDemo() {
  const { t } = useI18n();
  const [state, setState] = useState<OrgDemoState>(initialOrgDemo), [ready, setReady] = useState(false), [side, setSide] = useState<"visitor" | "organization">("visitor"), [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    (async () => { await Promise.resolve(); if (!live) return; try { setState(parseOrgDemo(JSON.parse(window.localStorage.getItem(storageKey) ?? "null"))); } catch { /* start fresh */ } setReady(true); })();
    return () => { live = false; };
  }, []);
  useEffect(() => { if (ready) try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* storage unavailable: the sandbox still works for this visit */ } }, [state, ready]);
  const counts = countsOf(state), list = applicantsOf(state);
  const mine = state.statuses[VISITOR_ID] ?? "submitted";
  const setStatus = (id: string, status: ReviewState) => setState(current => ({ ...current, statuses: { ...current.statuses, [id]: status } }));
  return <section className="oq-rec" aria-label={t("od.aria")}>
    <p className="fw-notice" role="note" data-demo="sample"><strong>{t("od.label")}</strong> {t("od.body")}</p>
    <h3>{orgDemoListing.title}</h3><p>{orgDemoListing.company} · {orgDemoListing.location}</p>
    <div className="oq-rec-chips" role="group" aria-label={t("od.sideAria")}>
      {(["visitor", "organization"] as const).map(option => <button key={option} className="fw-secondary" aria-pressed={side === option} onClick={() => setSide(option)}>{t(`od.side.${option}` as MessageKey)}</button>)}
    </div>
    {side === "visitor" ? <div aria-label={t("od.visitorAria")}>
      {state.visitorApplied ? <p role="status">{t("od.yourStatus", { status: t(`sub.s.${mine}` as MessageKey) })}</p> : <>
        <label className="fw-field">{t("od.message")}<textarea maxLength={300} value={message} onChange={e => setMessage(e.target.value)} /></label>
        <button className="fw-primary" onClick={() => setState(current => ({ ...current, visitorApplied: true, visitorMessage: message.trim(), statuses: { ...current.statuses, [VISITOR_ID]: "submitted" } }))}>{t("od.apply")}</button>
      </>}
      <p>{t("od.shares")}</p>
    </div> : <div aria-label={t("od.orgAria")}>
      <p>{t("od.counts", { total: list.length, submitted: counts.submitted, reviewing: counts.reviewing, shortlisted: counts.shortlisted, declined: counts.declined })}</p>
      <ul className="oq-rec-list" aria-label={t("od.applicantsAria")}>{list.map(item => <li key={item.id}>
        <strong>{item.name}</strong> · {t(`sub.s.${item.status}` as MessageKey)}
        <p>{item.message || t("am.noMessage")}</p>
        <div className="oq-rec-chips">{reviewStates.filter(status => status !== "submitted").map(status => <button key={status} className="fw-secondary" disabled={item.status === status} aria-label={t("am.markAs", { name: item.name, status: t(`sub.s.${status}` as MessageKey) })} onClick={() => setStatus(item.id, status)}>{t(`sub.s.${status}` as MessageKey)}</button>)}</div>
      </li>)}</ul>
    </div>}
    <button className="fw-secondary" onClick={() => { setState(initialOrgDemo); setMessage(""); }}>{t("od.reset")}</button>
    <p className="fw-notice">{t("od.real")}</p>
  </section>;
}

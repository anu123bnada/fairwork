"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { companySearchResponse, listResponse, NOTICE_VERSION, result as resultSchema, STATUS_LABEL, type Evidence, type RecruiterResult, type RecruiterStatus } from "@/features/recruiter/schema";
import { scamIndicators, type ScamIndicator } from "@/features/scam/check";
import { emailDomain } from "@/features/recruiter/domain";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { ReportProblem } from "./report-problem";

const STATUS_KEY: Record<RecruiterStatus, MessageKey> = { VERIFIED: "rv.status.verified", PARTIALLY_VERIFIED: "rv.status.partial", UNVERIFIED: "rv.status.unverified", CONFLICTING_EVIDENCE: "rv.status.conflicting" };
const EFFECT: Record<Evidence["effect"], string> = { supports: "Supports", contradicts: "Does not match", neutral: "Note", not_checked: "Not checked" };
const SOURCE: Record<Evidence["source"], string> = { employer_confirmation: "Employer's statement", live_check: "Observed by ORYQEN", registry: "Public registry", user_supplied: "Supplied by you", not_checked: "Not checked" };
const AREA: Record<Evidence["area"], string> = { decision: "Employer confirmation", employer: "Employer", domain: "Employer domain", email: "Email address", posting: "Job advertisement", profile: "Professional profile" };
const when = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

// Recruiter Identity & Affiliation Verification, inside the offer check. It shows what supports a claim, what contradicts it, what
// could not be checked, and who said what. It never calls anyone a name and never treats a profile, a name or an email format as proof.
export function RecruiterVerification({ defaultEmployer = "", defaultRole = "" }: { defaultEmployer?: string; defaultRole?: string }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ReturnType<typeof listResponse.parse>["items"] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<RecruiterResult | null>(null), [form, setForm] = useState({ recruiterName: "", claimedEmployer: defaultEmployer, roleTitle: defaultRole, email: "", employerSite: "", postingUrl: "", profileUrl: "" });
  const [acknowledged, setAcknowledged] = useState(false), [matches, setMatches] = useState<{ companyId: string; name: string }[]>([]), [companyId, setCompanyId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false), [message, setMessage] = useState(""), [wording, setWording] = useState<ScamIndicator[] | null>(null);
  const key = useRef<string | null>(null);

  const loadList = useCallback(async () => { setItems(listResponse.parse(await appRequest("/api/v1/recruiter")).items); }, []);
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/recruiter").then(raw => { if (active) setItems(listResponse.parse(raw).items); }).catch(() => { if (active) setError(t("rv.loadError")); });
    return () => { active = false; };
  }, [t]);

  async function showResult(id: string) {
    setBusy(true); setError(""); setWording(null); setConfirmDelete(false);
    try { setOpen(resultSchema.parse(await appRequest(`/api/v1/recruiter/result?id=${id}`))); } catch (caught) { setError(caught instanceof Error ? caught.message : t("rv.loadError")); } finally { setBusy(false); }
  }
  async function searchEmployer() {
    setError(""); setMatches([]); setCompanyId("");
    if (form.claimedEmployer.trim().length < 4) return setError(t("rv.searchShort"));
    try { const found = companySearchResponse.parse(await appRequest(`/api/v1/recruiter/companies?query=${encodeURIComponent(form.claimedEmployer.trim())}`)).items; setMatches(found); if (!found.length) setError(t("rv.searchNone")); } catch (caught) { setError(caught instanceof Error ? caught.message : t("rv.loadError")); }
  }
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      key.current ??= crypto.randomUUID();
      const body = { ...form, ...(companyId ? { companyId } : {}), noticeAcknowledged: true, idempotencyKey: key.current };
      const created = await appRequest("/api/v1/recruiter", body) as { verificationId: string };
      key.current = null; setForm({ recruiterName: "", claimedEmployer: defaultEmployer, roleTitle: defaultRole, email: "", employerSite: "", postingUrl: "", profileUrl: "" }); setAcknowledged(false); setMatches([]); setCompanyId("");
      await loadList(); await showResult(created.verificationId);
    } catch (caught) { setError(caught instanceof Error ? `${caught.message} ${t("rv.retryNote")}` : t("rv.loadError")); setBusy(false); }
  }
  async function remove() {
    if (!open) return; setBusy(true); setError("");
    try { await appRequest("/api/v1/recruiter/delete", { verificationId: open.claim.verificationId }); setOpen(null); setConfirmDelete(false); await loadList(); } catch (caught) { setError(caught instanceof Error ? caught.message : t("rv.loadError")); } finally { setBusy(false); }
  }
  function checkWording() {
    const domain = open?.evidence.find(item => item.area === "email" && item.effect === "supports") ? emailDomain(open.claim.email) ?? undefined : undefined;
    setWording(scamIndicators(message, { companyDomain: domain }));
  }
  const set = (name: keyof typeof form) => (event: { target: { value: string } }) => setForm(previous => ({ ...previous, [name]: event.target.value }));

  return <section className="fw-list-card fw-rv" aria-label={t("rv.title")}>
    <h3>{t("rv.title")}</h3>
    <p>{t("rv.intro")}</p>
    {error && <p role="alert">{error}</p>}

    {!open && <>
      {items && items.length > 0 && <ul aria-label={t("rv.yourChecks")}>{items.map(row => <li key={row.verificationId}>
        <strong>{row.recruiterName}</strong> · {row.claimedEmployer}{row.roleTitle ? ` · ${row.roleTitle}` : ""} · {row.employer.confirmations > 0 ? t("rv.employerConfirms") : row.employer.disputes > 0 ? t("rv.employerDisputes") : t("rv.noEmployerAnswer")}
        <button type="button" className="fw-secondary" disabled={busy} onClick={() => void showResult(row.verificationId)}>{t("rv.open")}</button>
      </li>)}</ul>}
      {items?.length === 0 && <p>{t("rv.none")}</p>}
      <form onSubmit={event => void create(event)} aria-label={t("rv.newCheck")}>
        <h4>{t("rv.newCheck")}</h4>
        <label className="fw-field">{t("rv.recruiterName")}<input required minLength={2} maxLength={120} value={form.recruiterName} onChange={set("recruiterName")} /></label>
        <label className="fw-field">{t("rv.employer")}<input required minLength={2} maxLength={120} value={form.claimedEmployer} onChange={event => { set("claimedEmployer")(event); setMatches([]); setCompanyId(""); }} /></label>
        <button type="button" className="fw-secondary" disabled={busy} onClick={() => void searchEmployer()}>{t("rv.findOnOryqen")}</button>
        {matches.length > 0 && <fieldset aria-label={t("rv.pickEmployer")}><legend>{t("rv.pickEmployer")}</legend>
          {matches.map(match => <label className="fw-field" key={match.companyId}><input type="radio" name="company" checked={companyId === match.companyId} onChange={() => setCompanyId(match.companyId)} />{match.name}</label>)}
          <p>{t("rv.pickNote")}</p></fieldset>}
        <label className="fw-field">{t("rv.role")}<input maxLength={120} value={form.roleTitle} onChange={set("roleTitle")} /></label>
        <label className="fw-field">{t("rv.email")}<input type="email" maxLength={254} value={form.email} onChange={set("email")} /></label>
        <label className="fw-field">{t("rv.site")}<input type="url" maxLength={300} placeholder="https://" value={form.employerSite} onChange={set("employerSite")} /></label>
        <label className="fw-field">{t("rv.posting")}<input type="url" maxLength={500} placeholder="https://" value={form.postingUrl} onChange={set("postingUrl")} /></label>
        <label className="fw-field">{t("rv.profile")}<input type="url" maxLength={300} placeholder="https://" value={form.profileUrl} onChange={set("profileUrl")} /></label>
        <p>{t("rv.notice")}</p>
        <label className="fw-field"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />{t("rv.acknowledge")}</label>
        <button className="fw-primary" disabled={busy || !acknowledged || form.recruiterName.trim().length < 2 || form.claimedEmployer.trim().length < 2} data-notice={NOTICE_VERSION}>{busy ? t("rv.working") : t("rv.check")}</button>
      </form>
    </>}

    {open && <article aria-label={t("rv.result")}>
      <button type="button" className="fw-secondary" onClick={() => { setOpen(null); setConfirmDelete(false); }}>{t("rv.back")}</button>
      <h4>{open.claim.recruiterName} · {open.claim.claimedEmployer}</h4>
      <p role="status" data-status={open.status}><strong>{t(STATUS_KEY[open.status])}</strong> ({STATUS_LABEL[open.status]}). {open.summary}</p>
      <p><small>{t("rv.asOf")} {when(open.generatedAt)} · {t("rv.expires")} {when(open.claim.expiresAt)}</small></p>
      {open.reasons.length > 0 && <><h5>{t("rv.why")}</h5><ul>{open.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></>}
      <h5>{t("rv.evidence")}</h5>
      <ul aria-label={t("rv.evidence")}>{open.evidence.map(item => <li key={item.id}>
        <strong>{AREA[item.area]} — {EFFECT[item.effect]}:</strong> {item.title}. <span>{item.detail}</span>
        <small> Source: {SOURCE[item.source]}{item.sourceLabel ? ` (${item.sourceLabel})` : ""}{item.observedAt ? ` · ${when(item.observedAt)}` : ""}</small>
        {item.sourceUrl && <> <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open the source</a></>}
      </li>)}</ul>
      {open.unresolved.length > 0 && <><h5>{t("rv.unresolved")}</h5><ul>{open.unresolved.map(text => <li key={text}>{text}</li>)}</ul></>}
      <details><summary>{t("rv.wordingTitle")}</summary>
        <p>{t("rv.wordingNote")}</p>
        <label className="fw-field">{t("rv.wordingLabel")}<textarea rows={4} maxLength={4000} value={message} onChange={event => { setMessage(event.target.value); setWording(null); }} /></label>
        <button type="button" className="fw-secondary" disabled={message.trim().length < 10} onClick={checkWording}>{t("rv.wordingCheck")}</button>
        {wording && (wording.length === 0 ? <p role="status">{t("rv.wordingNone")}</p> : <ul aria-label={t("rv.wordingTitle")}>{wording.map(entry => <li key={entry.id}><strong>{entry.title}</strong>: “{entry.quote}”. {entry.description}</li>)}</ul>)}
      </details>
      <details><summary>{t("rv.limits")}</summary><ul>{open.limits.map(text => <li key={text}>{text}</li>)}</ul></details>
      <ReportProblem kind="recruiter_check" subjectRef={open.claim.verificationId} subjectLabel={`${open.claim.recruiterName} · ${open.claim.claimedEmployer}`.slice(0, 120)} />
      <button type="button" className="fw-secondary" disabled={busy} onClick={() => void showResult(open.claim.verificationId)}>{t("rv.again")}</button>
      {confirmDelete
        ? <span role="group" aria-label={t("rv.confirmDelete")}> {t("rv.deleteQuestion")} <button type="button" className="fw-secondary" disabled={busy} onClick={() => void remove()}>{t("rv.deleteNow")}</button><button type="button" className="fw-secondary" onClick={() => setConfirmDelete(false)}>{t("rv.keep")}</button></span>
        : <button type="button" className="fw-secondary" disabled={busy} onClick={() => setConfirmDelete(true)}>{t("rv.delete")}</button>}
    </article>}
  </section>;
}

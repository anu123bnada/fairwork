"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { companyResultsSchema } from "@/features/authority/company-schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { queueResponse, domainRow } from "@/features/recruiter/schema";

type Queue = z.infer<typeof queueResponse>["items"];
const proofed = z.strictObject({ items: z.array(domainRow.extend({ proof: z.strictObject({ controlled: z.boolean(), method: z.enum(["dns", "well-known"]).nullable(), observedAt: z.string() }) })) });
const day = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";

// For approved representatives: say whether a named recruiter really works for the organization, and prove the organization controls its domain.
// Recruiters are shown without any information about the worker who asked.
export function RecruiterEmployerPanel() {
  const { t } = useI18n();
  const [queue, setQueue] = useState<Queue | null>(null), [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [companies, setCompanies] = useState<{ companyId: string; name: string | null }[]>([]), [companyId, setCompanyId] = useState("");
  const [domains, setDomains] = useState<z.infer<typeof proofed>["items"]>([]), [newDomain, setNewDomain] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({}), [days, setDays] = useState<Record<string, string>>({});
  const keys = useRef(new Map<string, string>());

  const fetchQueue = useCallback(async (next?: string | null) => queueResponse.parse(await appRequest(`/api/v1/recruiter/queue${next ? `?cursor=${encodeURIComponent(next)}` : ""}`)), []);
  const loadQueue = useCallback(async (next?: string | null) => {
    const page = await fetchQueue(next);
    setQueue(previous => next && previous ? [...previous, ...page.items] : page.items); setCursor(page.nextCursor);
  }, [fetchQueue]);
  useEffect(() => {
    let active = true;
    fetchQueue().then(page => { if (active) { setQueue(page.items); setCursor(page.nextCursor); } }).catch(() => { if (active) setQueue([]); });
    appRequest("/api/v1/companies").then(raw => { if (active) { const items = companyResultsSchema.parse(raw).items; setCompanies(items); setCompanyId(items[0]?.companyId ?? ""); } }).catch(() => undefined);
    return () => { active = false; };
  }, [fetchQueue]);

  const fetchDomains = useCallback(async (id: string) => proofed.parse(await appRequest(`/api/v1/recruiter/domains?companyId=${id}`)).items, []);
  const loadDomains = useCallback(async (id: string) => { setDomains(await fetchDomains(id)); }, [fetchDomains]);
  useEffect(() => { let active = true; if (companyId) fetchDomains(companyId).then(items => { if (active) setDomains(items); }).catch(() => { if (active) setDomains([]); }); return () => { active = false; }; }, [companyId, fetchDomains]);

  async function guard(action: () => Promise<void>) { setBusy(true); setError(""); try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : t("re.failed")); } finally { setBusy(false); } }
  function decide(verificationId: string, decision: "confirm" | "dispute" | "withdraw") {
    return guard(async () => {
      const reason = (reasons[verificationId] ?? "").trim();
      if (!reason) throw new Error(t("re.reasonFirst"));
      const validDays = decision === "confirm" ? Number(days[verificationId] || 90) : null;
      const fingerprint = JSON.stringify([verificationId, decision, reason, validDays]);
      let key = keys.current.get(fingerprint); if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
      await appRequest("/api/v1/recruiter/decide", { verificationId, decision, reason, validDays, idempotencyKey: key });
      setReasons(previous => ({ ...previous, [verificationId]: "" })); await loadQueue();
    });
  }

  return <section className="fw-list-card" aria-label={t("re.title")}>
    <h3>{t("re.title")}</h3>
    <p>{t("re.intro")}</p>
    {error && <p role="alert">{error}</p>}
    {queue?.length === 0 && <p>{t("re.none")}</p>}
    {queue?.map(item => <article key={item.verificationId} aria-label={`Recruiter ${item.recruiterName}`}>
      <strong>{item.recruiterName}</strong>{item.roleTitle ? ` · ${item.roleTitle}` : ""} <small>({item.companyName ?? "your organization"})</small>
      <p>{item.email ? `${t("re.emailGiven", { value: item.email })} ` : ""}{item.postingUrl ? `${t("re.adGiven", { value: item.postingUrl })} ` : ""}{t("re.asked", { date: day(item.createdAt) })} {t("re.decisions", { confirm: item.employer.confirmations, dispute: item.employer.disputes })}{item.mine ? ` ${t("re.yours", { decision: t(`re.d.${item.mine.decision}` as MessageKey), until: item.mine.validUntil ? t("re.until", { date: day(item.mine.validUntil) }) : "" })}` : ""}</p>
      <label className="fw-field">{t("re.reason")}<input maxLength={500} value={reasons[item.verificationId] ?? ""} onChange={event => setReasons(previous => ({ ...previous, [item.verificationId]: event.target.value }))} /></label>
      <label className="fw-field">{t("re.days")}<input type="number" min={1} max={180} value={days[item.verificationId] ?? "90"} onChange={event => setDays(previous => ({ ...previous, [item.verificationId]: event.target.value }))} /></label>
      <button type="button" className="fw-primary" disabled={busy} onClick={() => void decide(item.verificationId, "confirm")}>{t("re.confirm")}</button>
      <button type="button" className="fw-secondary" disabled={busy} onClick={() => void decide(item.verificationId, "dispute")}>{t("re.dispute")}</button>
      {item.mine && <button type="button" className="fw-secondary" disabled={busy} onClick={() => void decide(item.verificationId, "withdraw")}>{t("re.withdraw")}</button>}
    </article>)}
    {cursor && <button type="button" className="fw-secondary" disabled={busy} onClick={() => void guard(() => loadQueue(cursor))}>{t("re.more")}</button>}

    <h4>{t("re.domainsTitle")}</h4>
    <p>{t("re.domainsIntro")}</p>
    {companies.length > 0 ? <>
      <label className="fw-field">{t("re.organization")}<select value={companyId} onChange={event => setCompanyId(event.target.value)}>{companies.map(company => <option key={company.companyId} value={company.companyId}>{company.name ?? company.companyId}</option>)}</select></label>
      <ul aria-label="Claimed domains">{domains.map(domain => <li key={domain.domainId}>
        <strong>{domain.domain}</strong> — {domain.proof.controlled ? t("re.controlVia", { method: t(domain.proof.method === "dns" ? "re.viaDns" : "re.viaFile"), date: day(domain.proof.observedAt) }) : t("re.controlNotSeen")}
        <br /><code>oryqen-verification={domain.token}</code>
        <button type="button" className="fw-secondary" disabled={busy} onClick={() => void guard(async () => { await appRequest("/api/v1/recruiter/domains/remove", { domainId: domain.domainId }); await loadDomains(companyId); })}>{t("re.remove")}</button>
      </li>)}</ul>
      <form onSubmit={event => { event.preventDefault(); void guard(async () => { await appRequest("/api/v1/recruiter/domains", { companyId, domain: newDomain }); setNewDomain(""); await loadDomains(companyId); }); }}>
        <label className="fw-field">{t("re.addDomain")}<input value={newDomain} maxLength={253} placeholder="example.com" onChange={event => setNewDomain(event.target.value)} /></label>
        <button className="fw-secondary" disabled={busy || newDomain.trim().length < 4}>{t("re.addDomainButton")}</button>
      </form>
    </> : <p>{t("re.needOrg")}</p>}
  </section>;
}

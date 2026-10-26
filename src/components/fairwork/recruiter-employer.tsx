"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { companyResultsSchema } from "@/features/authority/company-schema";
import { queueResponse, domainRow } from "@/features/recruiter/schema";

type Queue = z.infer<typeof queueResponse>["items"];
const proofed = z.strictObject({ items: z.array(domainRow.extend({ proof: z.strictObject({ controlled: z.boolean(), method: z.enum(["dns", "well-known"]).nullable(), observedAt: z.string() }) })) });
const day = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";

// For approved representatives: say whether a named recruiter really works for the organization, and prove the organization controls its domain.
// Recruiters are shown without any information about the worker who asked.
export function RecruiterEmployerPanel() {
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

  async function guard(action: () => Promise<void>) { setBusy(true); setError(""); try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "That did not work. Retry."); } finally { setBusy(false); } }
  function decide(verificationId: string, decision: "confirm" | "dispute" | "withdraw") {
    return guard(async () => {
      const reason = (reasons[verificationId] ?? "").trim();
      if (!reason) throw new Error("Write a short reason first. It is shown with your decision.");
      const validDays = decision === "confirm" ? Number(days[verificationId] || 90) : null;
      const fingerprint = JSON.stringify([verificationId, decision, reason, validDays]);
      let key = keys.current.get(fingerprint); if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
      await appRequest("/api/v1/recruiter/decide", { verificationId, decision, reason, validDays, idempotencyKey: key });
      setReasons(previous => ({ ...previous, [verificationId]: "" })); await loadQueue();
    });
  }

  return <section className="fw-list-card" aria-label="Recruiter confirmations">
    <h3>Recruiter confirmations</h3>
    <p>People have asked whether the recruiters below really represent your organization. Confirm only people you know are authorized; dispute anyone who is not. Your decision is recorded with your name and time, can be withdrawn, and a confirmation expires. You will not see who asked.</p>
    {error && <p role="alert">{error}</p>}
    {queue?.length === 0 && <p>No recruiter is waiting for your decision.</p>}
    {queue?.map(item => <article key={item.verificationId} aria-label={`Recruiter ${item.recruiterName}`}>
      <strong>{item.recruiterName}</strong>{item.roleTitle ? ` · ${item.roleTitle}` : ""} <small>({item.companyName ?? "your organization"})</small>
      <p>{item.email ? `Email given: ${item.email}. ` : ""}{item.postingUrl ? `Advertisement: ${item.postingUrl}. ` : ""}Asked {day(item.createdAt)}. Decisions so far: {item.employer.confirmations} confirm, {item.employer.disputes} dispute.{item.mine ? ` Yours: ${item.mine.decision}${item.mine.validUntil ? ` until ${day(item.mine.validUntil)}` : ""}.` : ""}</p>
      <label className="fw-field">Reason (shown with your decision)<input maxLength={500} value={reasons[item.verificationId] ?? ""} onChange={event => setReasons(previous => ({ ...previous, [item.verificationId]: event.target.value }))} /></label>
      <label className="fw-field">Confirmation valid for (days, 1–180)<input type="number" min={1} max={180} value={days[item.verificationId] ?? "90"} onChange={event => setDays(previous => ({ ...previous, [item.verificationId]: event.target.value }))} /></label>
      <button type="button" className="fw-primary" disabled={busy} onClick={() => void decide(item.verificationId, "confirm")}>Confirm this person represents us</button>
      <button type="button" className="fw-secondary" disabled={busy} onClick={() => void decide(item.verificationId, "dispute")}>Dispute: this person is not authorized</button>
      {item.mine && <button type="button" className="fw-secondary" disabled={busy} onClick={() => void decide(item.verificationId, "withdraw")}>Withdraw my earlier decision</button>}
    </article>)}
    {cursor && <button type="button" className="fw-secondary" disabled={busy} onClick={() => void guard(() => loadQueue(cursor))}>Show more</button>}

    <h4>Prove your organization&apos;s domains</h4>
    <p>Recruiter email addresses and employer sites only count as organization evidence when the organization has shown it controls the domain. Publish the line below as a DNS TXT record at <code>_oryqen-verification.your-domain</code>, or as the only content of <code>https://your-domain/.well-known/oryqen-verification.txt</code>. ORYQEN checks it each time and never stores the result.</p>
    {companies.length > 0 ? <>
      <label className="fw-field">Organization<select value={companyId} onChange={event => setCompanyId(event.target.value)}>{companies.map(company => <option key={company.companyId} value={company.companyId}>{company.name ?? company.companyId}</option>)}</select></label>
      <ul aria-label="Claimed domains">{domains.map(domain => <li key={domain.domainId}>
        <strong>{domain.domain}</strong> — {domain.proof.controlled ? `control seen via ${domain.proof.method === "dns" ? "DNS" : "well-known file"} on ${day(domain.proof.observedAt)}` : "control not seen yet"}
        <br /><code>oryqen-verification={domain.token}</code>
        <button type="button" className="fw-secondary" disabled={busy} onClick={() => void guard(async () => { await appRequest("/api/v1/recruiter/domains/remove", { domainId: domain.domainId }); await loadDomains(companyId); })}>Remove</button>
      </li>)}</ul>
      <form onSubmit={event => { event.preventDefault(); void guard(async () => { await appRequest("/api/v1/recruiter/domains", { companyId, domain: newDomain }); setNewDomain(""); await loadDomains(companyId); }); }}>
        <label className="fw-field">Add a domain (up to 5)<input value={newDomain} maxLength={253} placeholder="example.com" onChange={event => setNewDomain(event.target.value)} /></label>
        <button className="fw-secondary" disabled={busy || newDomain.trim().length < 4}>Add domain</button>
      </form>
    </> : <p>Domain proof needs an organization you are authorized for.</p>}
  </section>;
}

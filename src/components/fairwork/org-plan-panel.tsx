"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { companyResultsSchema } from "@/features/authority/company-schema";
import { orgPlanIds, orgPlanIdSchema, orgPlans, type OrgPlanId } from "@/features/entitlements/catalog";

type Summary = { plan: { id: string; name: string; summary: string }; assignedAt: string | null; degraded: boolean; limits: { key: string; limit: number; used: number; remaining: number }[]; billing: { note: string } };
const LIMIT_LABEL: Record<string, string> = { liveListings: "Live opportunity listings" };

// For approved representatives: the organization's plan and how much of it is used. Plans are assigned by an operator; there is no billing.
export function OrganizationPlan() {
  const [companies, setCompanies] = useState<{ companyId: string; name: string | null }[]>([]), [companyId, setCompanyId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/companies").then(raw => { if (active) { const items = companyResultsSchema.parse(raw).items; setCompanies(items); setCompanyId(items[0]?.companyId ?? ""); } }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    if (companyId) appRequest(`/api/v1/organizations/plan?companyId=${companyId}`).then(raw => { if (active) { setSummary(raw as Summary); setError(""); } }).catch(() => { if (active) { setSummary(null); setError("The organization plan could not be loaded."); } });
    return () => { active = false; };
  }, [companyId]);
  if (companies.length === 0) return null;
  return <section className="fw-list-card" aria-label="Organization plan">
    <h3>Organization plan</h3>
    <label className="fw-field">Organization<select value={companyId} onChange={event => { setSummary(null); setCompanyId(event.target.value); }}>{companies.map(company => <option key={company.companyId} value={company.companyId}>{company.name ?? company.companyId}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}
    {summary && <>
      <p><strong>{summary.plan.name}</strong> — {summary.plan.summary}</p>
      {summary.degraded && <p role="note">The plan could not be confirmed just now, so the basic limits are shown.</p>}
      <ul>{summary.limits.map(limit => <li key={limit.key}>{LIMIT_LABEL[limit.key] ?? limit.key}: {limit.used} of {limit.limit} used</li>)}</ul>
      <p role="note">{summary.billing.note} Worker protections are never limited by an organization plan.</p>
    </>}
  </section>;
}

// Operator-only: set an organization's plan by organization ID. The database re-checks the capability, the second factor and conflicts of interest.
export function OrgPlanAssignment() {
  const [company, setCompany] = useState(""), [plan, setPlan] = useState<OrgPlanId>("org_team"), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("");
  const key = useRef<string | null>(null);
  const valid = z.uuid().safeParse(company.trim()).success && reason.trim().length > 0;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!valid) return; setBusy(true); setError(""); setDone("");
    try {
      key.current ??= crypto.randomUUID();
      const result = await appRequest("/api/v1/operator/org-entitlements", { companyId: company.trim(), plan, reason: reason.trim(), idempotencyKey: key.current }) as { plan: string; replayed: boolean };
      key.current = null; setDone(`Organization plan set to ${orgPlans[result.plan as OrgPlanId]?.name ?? result.plan}${result.replayed ? " (already applied)" : ""}.`); setReason("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The plan could not be assigned."); }
    finally { setBusy(false); }
  }
  return <form className="fw-list-card" onSubmit={event => void submit(event)} aria-label="Assign an organization plan">
    <p>Assignments are recorded with your account and reason and cannot be edited. You cannot set the plan of an organization in which you hold authority.</p>
    <label className="fw-field">Organization ID<input value={company} onChange={event => setCompany(event.target.value)} spellCheck={false} /></label>
    <label className="fw-field">Plan<select value={plan} onChange={event => setPlan(orgPlanIdSchema.parse(event.target.value))}>{orgPlanIds.map(id => <option key={id} value={id}>{orgPlans[id].name}</option>)}</select></label>
    <label className="fw-field">Reason (kept in the record)<input value={reason} maxLength={300} onChange={event => setReason(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}{done && <p role="status">{done}</p>}
    <button className="fw-primary" disabled={busy || !valid}>{busy ? "Saving…" : "Assign organization plan"}</button>
  </form>;
}

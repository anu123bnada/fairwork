"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { appRequest } from "@/features/authority/client";
import { planIds, planIdSchema, plans, type PlanId } from "@/features/entitlements/catalog";
import { useI18n } from "@/i18n/use-i18n";

const summary = z.object({
  plan: z.object({ id: planIdSchema, name: z.string(), summary: z.string() }), assignedAt: z.string().nullable(), degraded: z.boolean(),
  essentialFeatures: z.array(z.string()), limits: z.array(z.object({ key: z.string(), limit: z.number(), used: z.number(), remaining: z.number(), allowed: z.boolean() })),
  billing: z.object({ available: z.boolean(), note: z.string() }),
});
const LIMIT_LABEL: Record<string, string> = { activeCredentials: "Active shareable credentials" };
const FEATURE_LABEL: Record<string, string> = {
  passport: "Work Passport", work_records: "Work records", case_review: "Case review", employment_history: "Employment history", offer_assessment: "Offer assessment",
  guidance: "Private guidance", saved_analyses: "Saved analyses", trust_chain_view: "Trust Chain", credential_verification: "Checking credentials",
  privacy_requests: "Privacy requests", language_choice: "Language choice",
};

// What plan the person is on, what it limits, and which protections are never limited. There is no payment here.
export function PlanPanel() {
  const { t } = useI18n();
  const [data, setData] = useState<z.infer<typeof summary> | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/entitlements").then(raw => { if (active) setData(summary.parse(raw)); }).catch(() => { if (active) setError("Your plan could not be loaded. Retry when connected."); });
    return () => { active = false; };
  }, []);
  return <section className="fw-list-card" aria-label="Your plan">
    <h3>{t("plan.title")}</h3>
    {error && <p role="alert">{error}</p>}{!data && !error && <p role="status">Loading…</p>}
    {data && <>
      <p><strong>{data.plan.name}</strong> — {data.plan.summary}</p>
      {data.degraded && <p role="note">Your plan could not be confirmed just now, so the free limits are shown. Your protections are not affected.</p>}
      <ul>{data.limits.map(limit => <li key={limit.key}>{LIMIT_LABEL[limit.key] ?? limit.key}: {limit.used} of {limit.limit} used</li>)}</ul>
      <p>{t("plan.essentials")}</p>
      <ul>{data.essentialFeatures.map(feature => <li key={feature}>{FEATURE_LABEL[feature] ?? feature}</li>)}</ul>
      <p role="note">{data.billing.note} {t("plan.noBilling")}</p>
    </>}
  </section>;
}

// Operator-only: assign a plan to a participant by account ID. The database re-checks the capability, the second factor and self-assignment.
export function PlanAssignment() {
  const [subject, setSubject] = useState(""), [plan, setPlan] = useState<PlanId>("worker_plus"), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("");
  const key = useRef<string | null>(null);
  const valid = z.uuid().safeParse(subject.trim()).success && reason.trim().length > 0;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!valid) return; setBusy(true); setError(""); setDone("");
    try {
      key.current ??= crypto.randomUUID();
      const result = await appRequest("/api/v1/operator/entitlements", { subjectId: subject.trim(), plan, reason: reason.trim(), idempotencyKey: key.current }) as { plan: string; replayed: boolean };
      key.current = null; setDone(`Plan set to ${plans[result.plan as PlanId]?.name ?? result.plan}${result.replayed ? " (already applied)" : ""}.`); setReason("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The plan could not be assigned."); }
    finally { setBusy(false); }
  }
  return <form className="fw-list-card" onSubmit={event => void submit(event)} aria-label="Assign a plan">
    <p>Assignments are recorded with your account and reason, cannot be edited, and cannot be made to yourself.</p>
    <label className="fw-field">Participant account ID<input value={subject} onChange={event => setSubject(event.target.value)} spellCheck={false} /></label>
    <label className="fw-field">Plan<select value={plan} onChange={event => setPlan(planIdSchema.parse(event.target.value))}>{planIds.map(id => <option key={id} value={id}>{plans[id].name}</option>)}</select></label>
    <label className="fw-field">Reason (kept in the record)<input value={reason} maxLength={300} onChange={event => setReason(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}{done && <p role="status">{done}</p>}
    <button className="fw-primary" disabled={busy || !valid}>{busy ? "Saving…" : "Assign plan"}</button>
  </form>;
}

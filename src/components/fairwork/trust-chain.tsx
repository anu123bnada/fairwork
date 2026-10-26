"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { trustChainResponse, type TrustChainResponse, type TrustClaim } from "@/features/trust/schema";
import { useI18n } from "@/i18n/use-i18n";
import { IssueCredential, MyCredentials, type CredentialsData } from "./credentials-panel";

const ASSURANCE: Record<TrustClaim["verification"]["assurance"], string> = {
  independently_reviewed: "Reviewed by an employer representative",
  counterparty_acknowledged: "Acknowledged by both parties",
  self_reported: "Self-reported",
  unreviewed: "Not reviewed",
};
const STATE: Record<TrustClaim["validity"]["state"], string> = {
  active: "Valid as recorded", pending: "Waiting for review", disputed: "Disputed", rejected: "Rejected", withdrawn: "Withdrawn by you",
  retracted: "Verification retracted", superseded: "Replaced by a newer version", draft: "Draft, not submitted",
};
const TYPE: Record<TrustClaim["type"], string> = { employment_period: "Employment period", work_performed: "Work performed", offer_terms: "Offer terms" };
const FILTERS = [["all", "All"], ["reviewed", "Reviewed"], ["self", "Self-reported"], ["attention", "Needs attention"]] as const;
type Filter = (typeof FILTERS)[number][0];
const when = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

function matches(claim: TrustClaim, filter: Filter) {
  if (filter === "reviewed") return claim.verification.assurance === "independently_reviewed" || claim.verification.assurance === "counterparty_acknowledged";
  if (filter === "self") return claim.verification.assurance === "self_reported";
  if (filter === "attention") return ["disputed", "rejected", "retracted", "withdrawn"].includes(claim.validity.state);
  return true;
}

// Answers, for each claim: what is claimed, who provided it, who verified it and how, what evidence
// supports it, whether it is still valid, whether it can be challenged, and who can see it.
export function TrustChain() {
  const { t } = useI18n();
  const [data, setData] = useState<TrustChainResponse | null>(null), [error, setError] = useState(""), [filter, setFilter] = useState<Filter>("all");
  const [credentials, setCredentials] = useState<CredentialsData | null>(null);
  const loadCredentials = useCallback(async () => { try { setCredentials(await appRequest("/api/v1/credentials") as CredentialsData); } catch { setCredentials(null); } }, []);
  const load = useCallback(async () => {
    setError("");
    try { setData(trustChainResponse.parse(await appRequest("/api/v1/trust-chain"))); }
    catch { setData(null); setError("Your Trust Chain could not be loaded. Retry when connected."); }
  }, []);
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/trust-chain").then(raw => { if (active) setData(trustChainResponse.parse(raw)); })
      .catch(() => { if (active) setError("Your Trust Chain could not be loaded. Retry when connected."); });
    appRequest("/api/v1/credentials").then(raw => { if (active) setCredentials(raw as CredentialsData); }).catch(() => { /* credentials are optional; the chain still works */ });
    return () => { active = false; };
  }, []);
  const claims = data?.claims.filter(claim => matches(claim, filter)) ?? [];
  return <section className="fw-list-card fw-trust" aria-label={t("trust.title")}>
    <h3>{t("trust.title")}</h3>
    <p>Every important statement about your work, with who made it, who (if anyone) verified it, what supports it and whether it still stands. Read-only: it shows what the records say and changes nothing.</p>
    {error && <><p role="alert">{error}</p><button type="button" className="fw-secondary" onClick={() => { setData(null); void load(); }}>Retry</button></>}
    {!data && !error && <p role="status">Loading your claims…</p>}
    {data && <>
      <p role="status">{data.counts.total} claim{data.counts.total === 1 ? "" : "s"}: {data.counts.independentlyReviewed} reviewed by an employer representative, {data.counts.counterpartyAcknowledged} acknowledged by both parties, {data.counts.selfReported} self-reported, {data.counts.needsAttention} needing attention.</p>
      {data.truncated && <p role="note">Some records could not be read or exceeded the display limit, so this list may be incomplete.</p>}
      <div role="group" aria-label="Filter claims">{FILTERS.map(([key, label]) => <button type="button" key={key} className="fw-secondary" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {claims.length === 0 && <p>{data.counts.total === 0 ? "No claims yet. Add employment history, log work or save an offer to build your chain." : "No claims match this filter."}</p>}
      {claims.map(claim => <article className="fw-question-card" key={claim.claimId} aria-label={`${TYPE[claim.type]}: ${claim.statement}`}>
        <h4>{TYPE[claim.type]}</h4>
        <p><strong>{ASSURANCE[claim.verification.assurance]}</strong> · {STATE[claim.validity.state]}</p>
        <dl>
          <dt>What is claimed</dt><dd>{claim.statement}</dd>
          <dt>Who provided it</dt><dd>{claim.providedBy.label}</dd>
          <dt>Who verified it</dt><dd>{claim.verification.method}{when(claim.verification.verifiedAt) ? ` Verified ${when(claim.verification.verifiedAt)}.` : ""}{claim.verification.caveat ? ` ${claim.verification.caveat}` : ""}</dd>
          <dt>Evidence</dt><dd>{claim.evidence.length ? `${claim.evidence.length} private note${claim.evidence.length === 1 ? "" : "s"} attached` : "No supporting evidence recorded"}{claim.source.contentHash ? `; content fingerprint ${claim.source.contentHash.slice(0, 12)}…` : ""}</dd>
          <dt>Still valid?</dt><dd>{STATE[claim.validity.state]}. {claim.validity.expiresAt ? `Expires ${when(claim.validity.expiresAt)}.` : "No expiry is recorded."}{claim.validity.endedAt ? ` Ended ${when(claim.validity.endedAt)}${claim.validity.endedBy ? ` by ${claim.validity.endedBy === "you" ? "you" : "the employer representative"}` : ""}.` : ""}{claim.validity.reason ? ` Reason given: ${claim.validity.reason}` : ""}</dd>
          <dt>Can it be challenged?</dt><dd>{claim.challenge.how}{claim.challenge.href && <> <Link href={claim.challenge.href}>Open</Link></>}</dd>
          <dt>Who can see it</dt><dd>{claim.visibility.summary}{claim.visibility.manageHref && <> <Link href={claim.visibility.manageHref}>Manage sharing</Link></>}</dd>
        </dl>
        {credentials && <IssueCredential claim={claim} data={credentials} onIssued={() => void loadCredentials()} />}
        <details><summary>History ({claim.audit.length})</summary>{claim.audit.length ? <ol>{claim.audit.map((a, i) => <li key={i}>{when(a.at)} · {a.event}</li>)}</ol> : <p>No timestamped events are available for this claim.</p>}<small>Claim ID {claim.claimId.slice(0, 16)}…</small></details>
      </article>)}
      {credentials && <MyCredentials data={credentials} onChanged={() => void loadCredentials()} />}
      <details><summary>What the Trust Chain does not guarantee</summary><ul>{data.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></details>
    </>}
  </section>;
}

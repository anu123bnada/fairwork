import { createHash } from "node:crypto";
import type { EmploymentPage } from "@/features/work/employment-schema";
import type { WorkRecord } from "@/features/work/schema";
import type { AgreementRead } from "@/features/offer/read-schema";
import { TRUST_LIMITATIONS, type TrustChainResponse, type TrustClaim } from "./schema";

const claimId = (...parts: (string | number | null)[]) => createHash("sha256").update(["oryqen-trust-claim.v1", ...parts].join("|")).digest("hex");
const DEMO_CAVEAT = "The reviewer's organization authority was approved under the demo-authority.v1 policy. ORYQEN has not verified a real employer or legal identity.";
const byTime = (a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at);

export function employmentClaims(items: EmploymentPage["items"]): TrustClaim[] {
  return items.map(({ id, revision, content, savedAt }) => ({
    claimId: claimId("employment_entry", id, revision),
    type: "employment_period" as const,
    statement: `${content.role} at ${content.employer}, ${content.startDate} to ${content.current ? "present" : content.endDate}.`,
    source: { kind: "employment_entry" as const, id, version: revision, contentHash: null, recordedAt: savedAt },
    providedBy: { role: "you" as const, label: "You (self-reported)" },
    verification: { assurance: "self_reported" as const, method: "None. This is your own statement; no other party has confirmed it.", verifiedAt: null, verifier: null, caveat: null },
    evidence: [],
    validity: { state: "active" as const, expiresAt: null, endedAt: null, endedBy: null, reason: null, supersededByVersion: null },
    challenge: { possible: false, how: "Only you can change it, by saving a new revision. There is no verifier to dispute it because nobody has verified it.", href: "/app/work-record" },
    visibility: { summary: "Private to you. Self-reported history is not part of the shared Passport.", shareable: false, manageHref: null },
    audit: [{ at: savedAt, event: `Revision ${revision} saved`, by: "you" as const }],
  }));
}

export function workRecordClaims(records: WorkRecord[]): TrustClaim[] {
  return records.flatMap(record => {
    const current = record.versions.find(v => v.version === record.currentVersion) ?? record.versions.at(-1);
    if (!current) return [];
    const integrity = record.integrityEvents ?? [];
    const retract = integrity.find(e => e.operation === "retract" && e.version === current.version);
    const withdraw = integrity.find(e => e.operation === "withdraw");
    const decision = current.decision;
    const state = retract ? "retracted" as const : withdraw && (current.state === "withdrawn" || current.state === "invalidated") ? "withdrawn" as const
      : current.state === "verified" ? "active" as const : current.state === "disputed" ? "disputed" as const : current.state === "rejected" ? "rejected" as const
      : current.state === "submitted" ? "pending" as const : current.state === "draft" ? "draft" as const : current.state === "superseded" ? "superseded" as const
      : current.state === "withdrawn" ? "withdrawn" as const : "retracted" as const;
    const reviewed = decision?.outcome === "verified" && state === "active";
    const ended = retract ?? withdraw ?? null;
    const audit: TrustClaim["audit"] = [];
    for (const v of record.versions) {
      audit.push({ at: v.createdAt, event: `Version ${v.version} created`, by: "you" });
      if (v.submittedAt) audit.push({ at: v.submittedAt, event: `Version ${v.version} submitted for review`, by: "you" });
      if (v.decision) audit.push({ at: v.decision.recordedAt, event: `Version ${v.version} ${v.decision.outcome} by a representative`, by: "employer_representative" });
    }
    for (const e of integrity) audit.push({ at: e.recordedAt, event: `${e.operation === "correct" ? "Corrected" : e.operation === "withdraw" ? "Withdrawn" : "Verification retracted"} (version ${e.version})`, by: e.operation === "retract" ? "employer_representative" : "you" });
    const text = current.content;
    const period = text.periodStart === text.periodEnd ? text.periodStart : `${text.periodStart} to ${text.periodEnd}`;
    return [{
      claimId: claimId("work_record", record.workId, current.version, current.contentHash),
      type: "work_performed" as const,
      statement: `${text.role}: ${text.hours} hours, ${period}.`,
      source: { kind: "work_record" as const, id: record.workId, version: current.version, contentHash: current.contentHash, recordedAt: current.createdAt },
      providedBy: { role: "you" as const, label: "You submitted this record" },
      verification: reviewed
        ? { assurance: "independently_reviewed" as const, method: "An approved employer representative reviewed the exact record and its evidence; the decision is bound to the content and evidence hashes below.", verifiedAt: decision!.recordedAt, verifier: { role: "employer_representative" as const, authorityDecisionId: decision!.authorityDecisionId }, caveat: DEMO_CAVEAT }
        : { assurance: current.state === "draft" ? "unreviewed" as const : "self_reported" as const, method: current.state === "draft" ? "Not submitted yet." : decision ? `A representative recorded: ${decision.outcome}.` : "Submitted; waiting for a representative's review.", verifiedAt: null, verifier: decision && decision.outcome !== "verified" ? { role: "employer_representative" as const, authorityDecisionId: decision.authorityDecisionId } : null, caveat: decision && decision.outcome !== "verified" ? DEMO_CAVEAT : null },
      evidence: text.evidence.map(e => ({ id: e.id, kind: "text_note" as const, recordedAt: e.recordedAt })),
      validity: {
        state, expiresAt: null, endedAt: ended?.recordedAt ?? null,
        endedBy: ended ? (ended.operation === "retract" ? "employer_representative" as const : "you" as const) : null,
        reason: ended?.reason ?? (decision && decision.outcome !== "verified" ? decision.reason : null),
        supersededByVersion: integrity.find(e => e.operation === "correct" && e.version === current.version)?.nextVersion ?? null,
      },
      challenge: state === "active" || state === "pending" || state === "disputed" || state === "rejected"
        ? { possible: true, how: "You can open a case to dispute a decision or ask for a correction; cases are reviewed by someone independent of the original reviewer.", href: "/app/cases" }
        : { possible: state === "draft", how: state === "draft" ? "Nothing to challenge until you submit it." : "This claim has ended. A corrected record can be submitted as a new version.", href: state === "draft" ? null : "/app/work-record" },
      visibility: { summary: "Visible to you and the named employer representative. It enters your Passport only when you choose to share it with a named recipient, and you can revoke that access.", shareable: state === "active", manageHref: "/app/share" },
      audit: audit.sort(byTime),
    }];
  });
}

export function offerClaims(agreements: AgreementRead[]): TrustClaim[] {
  return agreements.map(({ offer, confirmation }) => {
    const confirmed = confirmation?.status === "confirmed";
    const open = offer.unresolved.length;
    const proposer = offer.requesterRole === "WORKER" ? "you" as const : "counterparty" as const;
    return {
      claimId: claimId("offer", offer.offerId, offer.version, offer.termHash),
      type: "offer_terms" as const,
      statement: `${String(offer.snapshot.role ?? "Offer")}: terms revision ${offer.version}${open ? `, ${open} question${open === 1 ? "" : "s"} still open` : ""}.`,
      source: { kind: "offer" as const, id: offer.offerId, version: offer.version, contentHash: offer.termHash, recordedAt: null },
      providedBy: { role: proposer, label: proposer === "you" ? "You proposed these terms" : "The other party proposed these terms" },
      verification: confirmed
        ? { assurance: "counterparty_acknowledged" as const, method: "Both parties independently acknowledged the exact terms hash. This records agreement on the terms; it is not a legally binding electronic signature.", verifiedAt: null, verifier: { role: "counterparty" as const, authorityDecisionId: null }, caveat: "ORYQEN acknowledgments are not legally binding electronic signatures." }
        : { assurance: "unreviewed" as const, method: confirmation ? "One party has acknowledged; waiting for the other." : "Nobody has acknowledged these terms yet.", verifiedAt: null, verifier: null, caveat: null },
      evidence: [],
      validity: { state: confirmed ? "active" as const : "pending" as const, expiresAt: null, endedAt: null, endedBy: null, reason: null, supersededByVersion: null },
      challenge: { possible: true, how: "Ask the other party about open questions, or raise a case if terms are not honored.", href: "/app/cases" },
      visibility: { summary: "Visible to you and the named participants of this offer only.", shareable: false, manageHref: null },
      // The agreement read exposes no event timestamps, so none are invented here.
      audit: [],
    };
  });
}

export function buildTrustChain(input: { employment: EmploymentPage["items"]; work: WorkRecord[]; agreements: AgreementRead[]; truncated: boolean }, now: Date): TrustChainResponse {
  const claims = [...workRecordClaims(input.work), ...offerClaims(input.agreements), ...employmentClaims(input.employment)];
  const attention = (c: TrustClaim) => ["disputed", "rejected", "retracted", "withdrawn"].includes(c.validity.state);
  return {
    generatedAt: now.toISOString(), claims,
    counts: {
      total: claims.length,
      independentlyReviewed: claims.filter(c => c.verification.assurance === "independently_reviewed").length,
      counterpartyAcknowledged: claims.filter(c => c.verification.assurance === "counterparty_acknowledged").length,
      selfReported: claims.filter(c => c.verification.assurance === "self_reported").length,
      needsAttention: claims.filter(attention).length,
    },
    sources: { employmentEntries: input.employment.length, workRecords: input.work.length, offers: input.agreements.length },
    truncated: input.truncated, limitations: TRUST_LIMITATIONS,
  };
}

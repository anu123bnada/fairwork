import { describe, expect, it } from "vitest";
import { buildTrustChain, employmentClaims, offerClaims, workRecordClaims } from "@/features/trust/build";
import { trustChainResponse, trustClaim } from "@/features/trust/schema";
import type { WorkRecord, WorkVersion } from "@/features/work/schema";
import type { AgreementRead } from "@/features/offer/read-schema";
import type { EmploymentPage } from "@/features/work/employment-schema";

const NOW = new Date("2026-10-26T12:00:00Z");
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const h = (c: string) => c.repeat(64);
const T = "2026-10-20T10:00:00+00:00";
function version(n: number, state: WorkVersion["state"], decision: WorkVersion["decision"] = null, extra: Partial<WorkVersion> = {}): WorkVersion {
  return {
    version: n, state, contentHash: h(String(n)), evidenceHash: h("e"), createdAt: `2026-10-0${n}T10:00:00+00:00`, submittedAt: state === "draft" ? null : `2026-10-0${n}T11:00:00+00:00`,
    content: { role: "Welder", periodStart: "2026-10-01", periodEnd: "2026-10-05", hours: "40", tasks: "Welded frames", evidence: [{ id: id(900 + n), ownerId: id(1), text: "PRIVATE-NOTE-TEXT", recordedAt: T }], schemaVersion: "work-record.v1", agreement: { id: id(5), version: 1, contentHash: h("a"), authorityDecisionId: id(6), effectiveAt: T, scope: "Engineering" } },
    decision, ...extra,
  } as WorkVersion;
}
const decision = (outcome: "verified" | "disputed" | "rejected"): NonNullable<WorkVersion["decision"]> => ({ id: id(70), outcome, reason: outcome === "verified" ? "Matches the site log" : "Hours differ from log", actorId: id(2), authorityDecisionId: id(80), contentHash: h("1"), evidenceHash: h("e"), recordedAt: "2026-10-02T09:00:00+00:00" });
const record = (versions: WorkVersion[], integrityEvents: NonNullable<WorkRecord["integrityEvents"]> = [], current = versions.length): WorkRecord =>
  ({ workId: id(10), agreementId: id(5), workerId: id(1), companyId: id(3), representativeId: id(2), currentVersion: current, versions, integrityEvents } as WorkRecord);

describe("work record claims", () => {
  it("shows a reviewed record with who, how, when, evidence and the demo-authority caveat", () => {
    const [claim] = workRecordClaims([record([version(1, "verified", decision("verified"))])]);
    expect(trustClaim.safeParse(claim).success).toBe(true);
    expect(claim!.verification).toMatchObject({ assurance: "independently_reviewed", verifiedAt: "2026-10-02T09:00:00+00:00", verifier: { role: "employer_representative", authorityDecisionId: id(80) } });
    expect(claim!.verification.caveat).toMatch(/demo-authority\.v1/); expect(claim!.verification.caveat).toMatch(/not verified a real employer/);
    expect(claim!.source.contentHash).toBe(h("1")); expect(claim!.evidence).toEqual([{ id: id(901), kind: "text_note", recordedAt: T }]);
    expect(claim!.validity).toMatchObject({ state: "active", expiresAt: null, endedAt: null });
    expect(claim!.visibility).toMatchObject({ shareable: true, manageHref: "/app/share" });
    expect(claim!.audit.map(a => a.event)).toEqual(["Version 1 created", "Version 1 submitted for review", "Version 1 verified by a representative"]);
    expect(JSON.stringify(claim)).not.toContain("PRIVATE-NOTE-TEXT"); // evidence text never leaves the vault view
  });
  it("never upgrades a draft, a pending submission, or a disputed or rejected decision to verified", () => {
    const states: [WorkVersion, string, string][] = [
      [version(1, "draft"), "unreviewed", "draft"], [version(1, "submitted"), "self_reported", "pending"],
      [version(1, "disputed", decision("disputed")), "self_reported", "disputed"], [version(1, "rejected", decision("rejected")), "self_reported", "rejected"],
    ];
    for (const [v, expectedAssurance, expectedState] of states) {
      const [claim] = workRecordClaims([record([v])]);
      expect(claim!.verification.assurance).toBe(expectedAssurance); expect(claim!.validity.state).toBe(expectedState);
      expect(claim!.verification.verifiedAt).toBeNull(); expect(claim!.visibility.shareable).toBe(false);
    }
    const [disputed] = workRecordClaims([record([version(1, "disputed", decision("disputed"))])]);
    expect(disputed!.validity.reason).toBe("Hours differ from log"); expect(disputed!.challenge).toMatchObject({ possible: true, href: "/app/cases" });
  });
  it("records a retracted verification as ended by the representative, with reason and time", () => {
    const [claim] = workRecordClaims([record([version(1, "invalidated", decision("verified"))], [{ id: id(90), version: 1, operation: "retract", actorId: id(2), reason: "Reviewed the wrong week", nextVersion: null, decisionId: id(70), recordedAt: "2026-10-09T08:00:00+00:00" }])]);
    expect(claim!.validity).toMatchObject({ state: "retracted", endedBy: "employer_representative", reason: "Reviewed the wrong week", endedAt: "2026-10-09T08:00:00+00:00" });
    expect(claim!.verification.assurance).not.toBe("independently_reviewed"); expect(claim!.visibility.shareable).toBe(false);
    expect(claim!.audit.at(-1)).toMatchObject({ event: "Verification retracted (version 1)", by: "employer_representative" });
  });
  it("shows a withdrawal by you and a correction as a new current version", () => {
    const [withdrawn] = workRecordClaims([record([version(1, "withdrawn")], [{ id: id(91), version: 1, operation: "withdraw", actorId: id(1), reason: "Entered twice", nextVersion: null, decisionId: null, recordedAt: "2026-10-03T08:00:00+00:00" }])]);
    expect(withdrawn!.validity).toMatchObject({ state: "withdrawn", endedBy: "you", reason: "Entered twice" });
    const [corrected] = workRecordClaims([record([version(1, "superseded"), version(2, "draft")], [{ id: id(92), version: 1, operation: "correct", actorId: id(1), reason: "Wrong hours", nextVersion: 2, decisionId: null, recordedAt: "2026-10-03T08:00:00+00:00" }])]);
    expect(corrected!.source.version).toBe(2); expect(corrected!.validity).toMatchObject({ state: "draft", supersededByVersion: null });
    expect(corrected!.claimId).not.toBe(workRecordClaims([record([version(1, "superseded")])])[0]!.claimId);
  });
});

describe("employment and offer claims", () => {
  const entry = (n: number, over: Partial<EmploymentPage["items"][number]["content"]> = {}): EmploymentPage["items"][number] => ({ id: id(200 + n), revision: n, savedAt: T, verification: "self_reported", content: { employer: "Synthetic Works", role: "Technician", startDate: "2021-03", endDate: null, current: true, skills: [], achievements: "", ...over } });
  it("keeps self-reported history self-reported, private and unshareable, never verified", () => {
    const [claim] = employmentClaims([entry(1)]);
    expect(claim!.verification).toMatchObject({ assurance: "self_reported", verifiedAt: null, verifier: null });
    expect(claim!.visibility).toMatchObject({ shareable: false, manageHref: null }); expect(claim!.statement).toContain("to present");
    expect(JSON.stringify(claim)).not.toMatch(/verified by|independently/i);
  });
  const agreement = (confirmation: AgreementRead["confirmation"], unresolved = 0): AgreementRead => ({
    offer: { offerId: id(300), companyId: id(3), workerId: id(1), representativeId: id(2), requesterId: id(2), requesterRole: "EMPLOYER", version: 2, termHash: h("c"), snapshot: { role: "Site Technician" }, changes: [], unresolved: Array.from({ length: unresolved }, (_, i) => ({ id: id(400 + i), field: "salary", question: "Q", required: true })) },
    agreementId: id(301), confirmation, answers: [], canConfirm: false,
  });
  it("marks mutual acknowledgement without calling it a signature, and unacknowledged terms unreviewed", () => {
    const [confirmed] = offerClaims([agreement({ agreementId: id(301), offerId: id(300), version: 2, confirmedBy: id(1), confirmationRole: "WORKER", currentHash: h("c"), status: "confirmed" })]);
    expect(confirmed!.verification).toMatchObject({ assurance: "counterparty_acknowledged" }); expect(confirmed!.verification.caveat).toMatch(/not legally binding/);
    expect(confirmed!.providedBy.role).toBe("counterparty"); expect(confirmed!.validity.state).toBe("active");
    const [open] = offerClaims([agreement(null, 2)]);
    expect(open!.verification.assurance).toBe("unreviewed"); expect(open!.validity.state).toBe("pending"); expect(open!.statement).toContain("2 questions still open");
    expect(open!.audit).toEqual([]);
  });
});

describe("whole chain", () => {
  it("counts by assurance, flags items needing attention, validates against the response schema and is deterministic", () => {
    const input = {
      employment: [{ id: id(201), revision: 1, savedAt: T, verification: "self_reported" as const, content: { employer: "A", role: "B", startDate: "2020-01", endDate: "2020-12", current: false, skills: [], achievements: "" } }],
      work: [record([version(1, "verified", decision("verified"))]), { ...record([version(1, "disputed", decision("disputed"))]), workId: id(11) }],
      agreements: [], truncated: false,
    };
    const chain = buildTrustChain(input, NOW);
    expect(trustChainResponse.safeParse(chain).success).toBe(true);
    expect(chain.counts).toEqual({ total: 3, independentlyReviewed: 1, counterpartyAcknowledged: 0, selfReported: 2, needsAttention: 1 });
    expect(chain.sources).toEqual({ employmentEntries: 1, workRecords: 2, offers: 0 });
    expect(new Set(chain.claims.map(c => c.claimId)).size).toBe(3);
    expect(buildTrustChain(input, NOW).claims.map(c => c.claimId)).toEqual(chain.claims.map(c => c.claimId));
    expect(chain.limitations.join(" ")).toMatch(/demo-authority\.v1/);
  });
  it("carries no identities of other people, only roles and authority-decision references", () => {
    const chain = buildTrustChain({ employment: [], work: [record([version(1, "verified", decision("verified"))])], agreements: [], truncated: true }, NOW);
    const text = JSON.stringify(chain);
    for (const personId of [id(1), id(2), id(3)]) expect(text).not.toContain(personId);
    expect(chain.truncated).toBe(true);
  });
});

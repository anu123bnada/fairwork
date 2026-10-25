import { z } from "zod";

// The Trust Chain answers seven questions for every important claim a user holds:
//   What is claimed? Who provided it? Who verified it, how, and when? What evidence supports it?
//   Is it still valid? Can it be challenged? Who can see it, and can that access be revoked?
// It is a read model derived from the authorized records themselves (offers, agreements, work
// records, employment entries). It stores nothing and adds no integrity guarantee beyond the hashes
// and decisions those records already hold.

export const claimType = z.enum(["employment_period", "work_performed", "offer_terms"]);
export type ClaimType = z.infer<typeof claimType>;

// How the claim is backed. Only "independently_reviewed" involves a second party acting under
// ORYQEN's approval policy; "self_reported" never does. Neither means a government or legal check.
export const assurance = z.enum(["self_reported", "counterparty_acknowledged", "independently_reviewed", "unreviewed"]);
export type Assurance = z.infer<typeof assurance>;

export const validityState = z.enum(["active", "pending", "disputed", "rejected", "withdrawn", "retracted", "superseded", "draft"]);
export type ValidityState = z.infer<typeof validityState>;

export const trustClaim = z.strictObject({
  claimId: z.string().regex(/^[0-9a-f]{64}$/),
  type: claimType,
  statement: z.string().max(400),
  source: z.strictObject({ kind: z.enum(["employment_entry", "work_record", "offer"]), id: z.uuid(), version: z.number().int().positive(), contentHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(), recordedAt: z.string().nullable() }),
  providedBy: z.strictObject({ role: z.enum(["you", "employer_representative", "counterparty"]), label: z.string().max(120) }),
  verification: z.strictObject({
    assurance,
    method: z.string().max(300),
    verifiedAt: z.string().nullable(),
    verifier: z.strictObject({ role: z.enum(["employer_representative", "counterparty"]), authorityDecisionId: z.uuid().nullable() }).nullable(),
    caveat: z.string().max(400).nullable(),
  }),
  evidence: z.array(z.strictObject({ id: z.uuid(), kind: z.literal("text_note"), recordedAt: z.string() })).max(50),
  validity: z.strictObject({
    state: validityState,
    expiresAt: z.string().nullable(),
    endedAt: z.string().nullable(),
    endedBy: z.enum(["you", "employer_representative"]).nullable(),
    reason: z.string().max(2000).nullable(),
    supersededByVersion: z.number().int().positive().nullable(),
  }),
  challenge: z.strictObject({ possible: z.boolean(), how: z.string().max(400), href: z.string().max(100).nullable() }),
  visibility: z.strictObject({ summary: z.string().max(300), shareable: z.boolean(), manageHref: z.string().max(100).nullable() }),
  audit: z.array(z.strictObject({ at: z.string(), event: z.string().max(120), by: z.enum(["you", "employer_representative", "counterparty", "system"]) })).max(60),
});
export type TrustClaim = z.infer<typeof trustClaim>;

export const trustChainResponse = z.strictObject({
  generatedAt: z.string(),
  claims: z.array(trustClaim).max(200),
  counts: z.strictObject({ total: z.number().int(), independentlyReviewed: z.number().int(), counterpartyAcknowledged: z.number().int(), selfReported: z.number().int(), needsAttention: z.number().int() }),
  sources: z.strictObject({ employmentEntries: z.number().int(), workRecords: z.number().int(), offers: z.number().int() }),
  truncated: z.boolean(),
  limitations: z.array(z.string().max(500)).min(1).max(8),
});
export type TrustChainResponse = z.infer<typeof trustChainResponse>;

export const TRUST_LIMITATIONS = [
  "A claim marked independently reviewed was confirmed by an employer representative whose organization authority was approved under ORYQEN's demo-authority.v1 policy. ORYQEN has not verified a real employer or legal identity, so treat it as a recorded review, not a legal or government verification.",
  "Self-reported claims are statements by you. They are never shown as verified and cannot be shared from here.",
  "Hashes shown are those stored with the source records. The Trust Chain is a read-only view and adds no integrity guarantee of its own; the database's append-only rules protect history against ordinary application changes, not against a database owner.",
  "No expiry is recorded for any claim type today, so none is shown. Corrections, withdrawals and retractions are shown as they happened.",
];

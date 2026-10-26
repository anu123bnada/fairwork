import { z } from "zod";

// Recruiter Identity & Affiliation Verification: shapes shared by the screens, the routes and the checks.
export const NOTICE_VERSION = "recruiter-verification.v1" as const;
export const statuses = ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "CONFLICTING_EVIDENCE"] as const;
export type RecruiterStatus = (typeof statuses)[number];
export const STATUS_LABEL: Record<RecruiterStatus, string> = { VERIFIED: "Verified", PARTIALLY_VERIFIED: "Partially verified", UNVERIFIED: "Unverified", CONFLICTING_EVIDENCE: "Conflicting evidence" };

const httpsUrl = z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/, "Use a full https:// address");
const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => (value ? value : undefined));
export const claimInput = z.strictObject({
  recruiterName: z.string().trim().min(2).max(120),
  claimedEmployer: z.string().trim().min(2).max(120),
  roleTitle: optionalText(120),
  email: z.string().trim().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a full email address").optional().or(z.literal("").transform(() => undefined)),
  profileUrl: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
  employerSite: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
  postingUrl: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
  companyId: z.uuid().optional(),
  registryLei: z.string().regex(/^[A-Z0-9]{20}$/).optional(),
  // The person confirms they understand they are entering another person's details for a limited purpose.
  noticeAcknowledged: z.literal(true),
  idempotencyKey: z.uuid(),
});
export type ClaimInput = z.infer<typeof claimInput>;

export const evidence = z.strictObject({
  id: z.string().max(60),
  area: z.enum(["employer", "domain", "email", "posting", "profile", "decision"]),
  // Where the fact comes from: an employer's own confirmation, something ORYQEN observed just now, a third-party registry,
  // something the person typed (never proof), or something ORYQEN did not or cannot check.
  source: z.enum(["employer_confirmation", "live_check", "registry", "user_supplied", "not_checked"]),
  effect: z.enum(["supports", "contradicts", "neutral", "not_checked"]),
  // A material contradiction (a look-alike address, an employer dispute) makes the overall result conflicting.
  material: z.boolean(),
  // Only when an employer has also confirmed this person does a mismatch become material.
  materialWhenConfirmed: z.boolean().default(false),
  title: z.string().max(200),
  detail: z.string().max(700),
  sourceLabel: z.string().max(120).nullable(),
  sourceUrl: z.string().max(500).nullable(),
  observedAt: z.string().nullable(),
  quote: z.string().max(300).nullable().default(null),
});
export type Evidence = z.infer<typeof evidence>;

export const employerState = z.strictObject({ confirmations: z.number().int().nonnegative(), disputes: z.number().int().nonnegative(), confirmedUntil: z.string().nullable().optional(), lastDecisionAt: z.string().nullable().optional() });
export const claimRow = z.strictObject({
  verificationId: z.uuid(), companyId: z.uuid().nullable(), recruiterName: z.string(), claimedEmployer: z.string(), roleTitle: z.string().nullable(), email: z.string().nullable(),
  profileUrl: z.string().nullable(), employerSite: z.string().nullable(), postingUrl: z.string().nullable(), registryLei: z.string().nullable(), createdAt: z.string(), expiresAt: z.string(),
  employer: employerState, decisions: z.array(z.strictObject({ decision: z.enum(["confirm", "dispute", "withdraw"]), reason: z.string(), validUntil: z.string().nullable(), at: z.string() })),
});
export const listRow = z.strictObject({ verificationId: z.uuid(), recruiterName: z.string(), claimedEmployer: z.string(), roleTitle: z.string().nullable(), companyId: z.uuid().nullable(), createdAt: z.string(), expiresAt: z.string(), employer: employerState });
export const listResponse = z.strictObject({ items: z.array(listRow).max(20) });

export const result = z.strictObject({
  generatedAt: z.string(),
  status: z.enum(statuses),
  summary: z.string().max(500),
  reasons: z.array(z.string().max(300)).max(12),
  unresolved: z.array(z.string().max(300)).max(12),
  evidence: z.array(evidence).max(30),
  claim: claimRow,
  limits: z.array(z.string().max(300)).max(8),
});
export type RecruiterResult = z.infer<typeof result>;

export const queueItem = z.strictObject({
  verificationId: z.uuid(), companyId: z.uuid(), companyName: z.string().nullable(), recruiterName: z.string(), roleTitle: z.string().nullable(), email: z.string().nullable(), postingUrl: z.string().nullable(),
  createdAt: z.string(), expiresAt: z.string(), mine: z.strictObject({ decision: z.enum(["confirm", "dispute", "withdraw"]), validUntil: z.string().nullable(), at: z.string() }).nullable(), employer: employerState,
});
export const queueResponse = z.strictObject({ items: z.array(queueItem).max(20), nextCursor: z.string().nullable() });
export const decideInput = z.strictObject({
  verificationId: z.uuid(), decision: z.enum(["confirm", "dispute", "withdraw"]), reason: z.string().trim().min(1).max(500),
  validDays: z.number().int().min(1).max(180).nullable(), idempotencyKey: z.uuid(),
});
export const domainRow = z.strictObject({ domainId: z.uuid(), domain: z.string(), token: z.string(), createdAt: z.string() });
export const domainList = z.strictObject({ items: z.array(domainRow).max(5) });
export const companySearchResponse = z.strictObject({ items: z.array(z.strictObject({ companyId: z.uuid(), name: z.string() })).max(5) });

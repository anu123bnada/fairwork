import { z } from "zod";

export const companyInput = z.object({ name: z.string().trim().min(1).max(120) }).strict();
export const membershipInput = z.object({
  companyId: z.uuid(), subjectId: z.uuid(), decision: z.enum(["approve", "revoke"]),
  expectedRevision: z.number().int().min(0).max(999999999),
  expiresAt: z.iso.datetime({ precision: 3 }).nullable(),
  reviewedEvidenceRefs: z.array(z.string().regex(/^demo:[A-Za-z0-9._/-]{1,120}$/)).min(1).max(10),
  reason: z.string().trim().min(1).max(500), policyVersion: z.literal("demo-authority.v1"),
}).strict().refine(v => v.decision === "revoke" ? v.expiresAt === null : v.expiresAt !== null, { path: ["expiresAt"] });
export const companyResult = z.object({ id: z.uuid(), name: z.string(), identityLabel: z.literal("demo_provisioned"), revision: z.literal(1) }).strict();
export const membershipResult = z.object({ companyId: z.uuid(), subjectId: z.uuid(), appliedDecisionId: z.uuid(), currentDecisionId: z.uuid(), decision: z.enum(["approve", "revoke"]), revision: z.number().int().positive(), assuranceLabel: z.literal("demo_provisioned"), active: z.boolean() }).strict();
export const mfaInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll") }).strict(),
  z.object({ action: z.literal("verify"), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }).strict(),
]);

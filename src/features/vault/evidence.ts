import { z } from "zod";

// The worker's own statements about their own Evidence Vault documents (module 06): a revocation (withdrawn or superseded) and correction notes. Neither is verification
// by an employer or reviewer, and neither is visible to anyone but the owner.
export const evidenceLimits = { reasonMax: 300, noteMax: 500, openNotesPerDocument: 20 } as const;
export const revokeInput = z.strictObject({ documentId: z.uuid(), reason: z.string().trim().min(1).max(evidenceLimits.reasonMax) });
export const reinstateInput = z.strictObject({ documentId: z.uuid() });
export const correctionInput = z.strictObject({ correctionId: z.uuid(), documentId: z.uuid(), note: z.string().trim().min(1).max(evidenceLimits.noteMax), idempotencyKey: z.uuid() });
export const resolveInput = z.strictObject({ correctionId: z.uuid() });
export const evidenceStatusList = z.strictObject({
  items: z.array(z.strictObject({
    documentId: z.uuid(), revoked: z.boolean(), reason: z.string().nullable(), revokedAt: z.string().nullable(),
    corrections: z.array(z.strictObject({ correctionId: z.uuid(), note: z.string(), createdAt: z.string(), resolvedAt: z.string().nullable() })),
  })),
});
export const revoked = z.strictObject({ documentId: z.uuid(), revoked: z.boolean() });
export const correctionAdded = z.strictObject({ correctionId: z.uuid(), replayed: z.boolean() });
export type EvidenceStatus = z.infer<typeof evidenceStatusList>["items"][number];

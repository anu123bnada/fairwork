import { z } from "zod";

// Result of recomputing the cross-record audit hash chain (module 10). `head` is the hash an administrator can record outside the database to anchor the chain.
export const auditChainResult = z.strictObject({
  checked: z.number().int().min(0), ok: z.boolean(), brokenLinks: z.number().int().min(0), alteredOrDeletedRecords: z.number().int().min(0),
  recordsNotInChain: z.number().int().min(0), firstProblemSeq: z.number().int().nullable(), head: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
});
export type AuditChainResult = z.infer<typeof auditChainResult>;

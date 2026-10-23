import { z } from "zod";
export const organizationRequestSchema = z.strictObject({
 companyId: z.uuid().nullable(), companyName: z.string().trim().min(1).max(120).nullable(), statement: z.string().trim().min(1).max(500),
}).refine(v => (v.companyId === null) !== (v.companyName === null));
export const organizationDecisionSchema = z.strictObject({
 requestId: z.uuid(), decision: z.enum(["approve", "reject"]), reason: z.string().trim().min(1).max(500),
 expiresAt: z.iso.datetime({ precision: 3 }).nullable(), expectedRevision: z.number().int().min(0).max(999999999),
 reviewedEvidenceRefs: z.array(z.string().regex(/^demo:[A-Za-z0-9._/-]{1,120}$/)).max(10),
}).refine(v => v.decision === "approve" ? v.expiresAt !== null && v.reviewedEvidenceRefs.length > 0 : v.expiresAt === null && v.reviewedEvidenceRefs.length === 0);
export const organizationPageRequest = z.strictObject({ cursor: z.uuid().nullable().default(null) });
const base = { requestId: z.uuid(), companyId: z.uuid().nullable(), companyName: z.string().nullable(), statement: z.string(), createdAt: z.string(),parentRequestId:z.uuid().nullable().optional() };
export const organizationListSchema = z.strictObject({ items: z.array(z.strictObject({ ...base, decision: z.enum(["approve", "reject"]).nullable(), reason: z.string().nullable(), active: z.boolean(),appealRequestId:z.uuid().nullable().optional() })).max(20), nextCursor: z.uuid().nullable() });
export const organizationQueueSchema = z.strictObject({ items: z.array(z.strictObject({ ...base, subjectId: z.uuid(),previousDecisionReason:z.string().nullable().optional() })).max(20), nextCursor: z.uuid().nullable() });
export const organizationAppealSchema=z.strictObject({requestId:z.uuid(),grounds:z.string().trim().min(10).max(500)});
export const organizationAppealReceipt=z.strictObject({requestId:z.uuid(),parentRequestId:z.uuid()});
export const organizationReceiptSchema = z.strictObject({ requestId: z.uuid() });
export const organizationDecisionReceipt = z.strictObject({ requestId: z.uuid(), decision: z.enum(["approve", "reject"]), companyId: z.uuid().nullable() });
export type OrganizationList = z.infer<typeof organizationListSchema>;
export type OrganizationQueue = z.infer<typeof organizationQueueSchema>;

import { z } from "zod";

// Private qualification records (batch 7, section B; the database objects exist only after the owner approves that batch, until then the route answers 503).
// The verification label is a fact the server derives, never something the client sends, and this contract has no value that means "verified by someone else":
//  - self_reported:      the person typed it in, nothing attached
//  - document_attached:  the person attached one of their own Evidence Vault documents (still not a check by anyone)
// `independentlyVerified` is the literal false, so a response that ever claimed otherwise would fail to parse instead of being shown.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const qualificationKind = z.enum(["certificate", "licence", "course", "degree", "other"]);
export const qualificationContent = z.strictObject({
  title: z.string().trim().min(1).max(120),
  issuer: z.string().trim().min(1).max(120).nullable(),
  kind: qualificationKind,
  issuedOn: month.nullable(),
  expiresOn: month.nullable(),
  documentId: z.uuid().nullable(),
}).refine(v => v.issuedOn === null || v.expiresOn === null || v.expiresOn >= v.issuedOn, { message: "Invalid dates" });
export const qualificationSave = z.strictObject({ operation: z.literal("save"), id: z.uuid(), expectedRevision: z.number().int().min(0).max(999999999), idempotencyKey: z.uuid(), content: qualificationContent });
export const qualificationRemove = z.strictObject({ operation: z.literal("remove"), id: z.uuid(), expectedRevision: z.number().int().min(1).max(999999999), idempotencyKey: z.uuid() });
export const qualificationCommand = z.discriminatedUnion("operation", [qualificationSave, qualificationRemove]);
export const qualificationList = z.strictObject({ operation: z.literal("list"), cursor: z.uuid().nullable() });
export const qualificationReceipt = z.strictObject({ id: z.uuid(), revision: z.number().int().positive(), saved: z.literal(true) });
export const qualificationPage = z.strictObject({
  items: z.array(z.strictObject({
    id: z.uuid(), revision: z.number().int().positive(), content: qualificationContent, savedAt: z.string(),
    verification: z.enum(["self_reported", "document_attached"]), independentlyVerified: z.literal(false),
  })).max(20),
  nextCursor: z.uuid().nullable(),
});
export type QualificationPage = z.infer<typeof qualificationPage>;

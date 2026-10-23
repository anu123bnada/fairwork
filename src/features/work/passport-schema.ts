import { z } from "zod";
const time=z.iso.datetime({offset:true}),hash=z.string().regex(/^[0-9a-f]{64}$/);
export const passportReadRequestSchema=z.strictObject({cursor:z.uuid().nullable()});
export const passportInitializeSchema=z.strictObject({idempotencyKey:z.uuid()});
export const passportReceiptSchema=z.strictObject({passportId:z.uuid(),ownerId:z.uuid(),createdAt:time});
export const passportEntrySchema=z.strictObject({
 workId:z.uuid(),version:z.number().int().positive(),role:z.string(),periodStart:z.iso.date(),periodEnd:z.iso.date(),hours:z.string(),summary:z.string().max(240),
 companyId:z.uuid(),companyName:z.string().nullable(),agreementId:z.uuid(),agreementVersion:z.number().int().positive(),agreementHash:hash,agreementEffectiveAt:time,
 verificationId:z.uuid(),verifiedAt:time,verifierId:z.uuid(),authorityDecisionId:z.uuid(),evidenceCount:z.number().int().nonnegative(),evidenceHash:hash,
});
export const passportSchema=z.strictObject({policyVersion:z.literal("private-work-passport.v1"),passportId:z.uuid().nullable(),ownerId:z.uuid(),createdAt:time.nullable(),entries:z.array(passportEntrySchema).max(20),nextCursor:z.uuid().nullable()});
export type Passport=z.infer<typeof passportSchema>;

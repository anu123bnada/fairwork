import { z } from "zod";
const hash=z.string().regex(/^[0-9a-f]{64}$/);
const time=z.iso.datetime({offset:true});
export const workState=z.enum(["draft","submitted","verified","disputed","rejected","superseded","withdrawn","invalidated"]);
export const workPayloadSchema=z.strictObject({role:z.string().trim().min(1).max(120),periodStart:z.iso.date(),periodEnd:z.iso.date(),hours:z.string().regex(/^(0|[1-9][0-9]{0,4})(\.[0-9]{1,2})?$/),tasks:z.string().trim().min(1).max(4000),evidence:z.array(z.string().trim().min(1).max(2000)).max(10)}).refine(p=>p.periodEnd>=p.periodStart);
const base={workId:z.uuid(),idempotencyKey:z.uuid()};
const expected={expectedVersion:z.number().int().positive(),expectedHash:hash,expectedState:workState,expectedEvidenceHash:hash};
export const workCommandSchema=z.discriminatedUnion("operation",[
 z.strictObject({...base,operation:z.literal("create"),agreementId:z.uuid(),agreementVersion:z.number().int().positive(),payload:workPayloadSchema}),
 z.strictObject({...base,...expected,operation:z.literal("revise"),agreementVersion:z.number().int().positive(),payload:workPayloadSchema}),
 z.strictObject({...base,...expected,operation:z.literal("reopen"),agreementVersion:z.number().int().positive(),payload:workPayloadSchema}),
 z.strictObject({...base,...expected,operation:z.literal("submit")}),
 z.strictObject({...base,...expected,operation:z.literal("decide"),outcome:z.enum(["verified","disputed","rejected"]),reason:z.string().trim().min(1).max(2000)}),
]);
const evidence=z.strictObject({id:z.uuid(),ownerId:z.uuid(),text:z.string(),recordedAt:time});
export const workEvidenceSchema=evidence.extend({workId:z.uuid(),version:z.number().int().positive()});
export const workVersionSchema=z.strictObject({version:z.number().int().positive(),state:workState,contentHash:hash,evidenceHash:hash,createdAt:time,submittedAt:time.nullable(),
 content:z.strictObject({...workPayloadSchema.shape,evidence:z.array(evidence),schemaVersion:z.literal("work-record.v1"),agreement:z.strictObject({id:z.uuid(),version:z.number().int().positive(),contentHash:hash,authorityDecisionId:z.uuid(),effectiveAt:time,scope:z.string()})}),
 decision:z.strictObject({id:z.uuid(),outcome:z.enum(["verified","disputed","rejected"]),reason:z.string(),actorId:z.uuid(),authorityDecisionId:z.uuid(),contentHash:hash,evidenceHash:hash,recordedAt:time}).nullable(),
});
export const integrityEventSchema=z.strictObject({id:z.uuid(),version:z.number().int().positive(),operation:z.enum(["withdraw","correct","retract"]),actorId:z.uuid(),reason:z.string(),nextVersion:z.number().int().positive().nullable(),decisionId:z.uuid().nullable(),recordedAt:time});
export const workReadSchema=z.strictObject({workId:z.uuid(),agreementId:z.uuid(),workerId:z.uuid(),companyId:z.uuid(),representativeId:z.uuid(),currentVersion:z.number().int().positive(),versions:z.array(workVersionSchema),integrityEvents:z.array(integrityEventSchema).optional()});
export const workReceiptSchema=z.strictObject({workId:z.uuid(),version:z.number().int().positive(),contentHash:hash,evidenceHash:hash,state:workState,actorId:z.uuid(),operation:z.enum(["create","revise","reopen","submit","decide"]),decisionId:z.uuid().nullable(),recordedAt:time});
export const workListSchema=z.strictObject({items:z.array(z.strictObject({workId:z.uuid(),version:z.number().int().positive(),state:workState,hours:z.string(),periodStart:z.iso.date(),periodEnd:z.iso.date()})),nextCursor:z.uuid().nullable()});
export const workReadRequestSchema=z.strictObject({workId:z.uuid()});
export const workListRequestSchema=z.strictObject({cursor:z.uuid().nullable()});
export type WorkRecord=z.infer<typeof workReadSchema>;
export type WorkVersion=z.infer<typeof workVersionSchema>;
export type WorkList=z.infer<typeof workListSchema>;
export type WorkCommand=z.infer<typeof workCommandSchema>;

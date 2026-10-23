import { z } from "zod";
import { workState } from "@/features/work/schema";
const hash=z.string().regex(/^[0-9a-f]{64}$/),time=z.iso.datetime({offset:true});
export const caseReason=z.enum(["work_inaccurate","evidence_integrity","verification_conflict","suspected_fraud"]);
export const caseOutcome=z.enum(["dismiss","uphold","correction_required"]);
const base={caseId:z.uuid(),idempotencyKey:z.uuid()},revision={expectedRevision:z.number().int().positive()};
export const caseCommandSchema=z.discriminatedUnion("operation",[
 z.strictObject({...base,operation:z.literal("open"),workId:z.uuid(),expectedVersion:z.number().int().positive(),expectedHash:hash,expectedEvidenceHash:hash,expectedState:workState,reasonCode:caseReason,reason:z.string().trim().min(1).max(2000)}),
 z.strictObject({...base,...revision,operation:z.literal("assign"),reviewerId:z.uuid(),expiresAt:time,reason:z.string().trim().min(1).max(2000)}),
 z.strictObject({...base,...revision,operation:z.literal("accept"),noConflict:z.boolean()}),
 z.strictObject({...base,...revision,operation:z.literal("revoke"),reason:z.string().trim().min(1).max(2000)}),
 z.strictObject({...base,...revision,operation:z.literal("decide"),outcome:caseOutcome,rationale:z.string().trim().min(1).max(4000)}),
]);
const status=z.enum(["open","resolved"]),operation=z.enum(["open","assign","accept","refuse","revoke","decide"]);
const summary={caseId:z.uuid(),workId:z.uuid(),workVersion:z.number().int().positive(),revision:z.number().int().positive(),status,openedAt:time};
export const caseReadSchema=z.strictObject({...summary,reasonCode:caseReason.nullable(),reason:z.string().nullable(),closedAt:time.nullable(),outcome:caseOutcome.nullable(),
 basis:z.strictObject({role:z.string(),tasks:z.string(),hours:z.string(),periodStart:z.iso.date(),periodEnd:z.iso.date(),contentHash:hash,evidenceHash:hash,evidence:z.array(z.strictObject({id:z.uuid(),ownerId:z.uuid(),text:z.string(),recordedAt:time}))}).nullable(),
 assignment:z.strictObject({id:z.uuid(),reviewerId:z.uuid(),expiresAt:time,acceptedAt:time.nullable(),revokedAt:time.nullable()}).nullable(),
 resolution:z.strictObject({outcome:caseOutcome,rationale:z.string(),reviewerId:z.uuid(),assignmentId:z.uuid(),recordedAt:time}).nullable(),
 events:z.array(z.strictObject({id:z.uuid(),revision:z.number().int().positive(),actorId:z.uuid(),operation,note:z.string(),recordedAt:time})),
 permissions:z.strictObject({canAssign:z.boolean(),canRevoke:z.boolean(),canAccept:z.boolean(),canDecide:z.boolean()}),
});
export const caseListSchema=z.strictObject({items:z.array(z.strictObject(summary)),nextCursor:z.uuid().nullable()});
export const caseReceiptSchema=z.strictObject({caseId:z.uuid(),revision:z.number().int().positive(),status,operation,actorId:z.uuid(),recordedAt:time});
export const caseReadRequestSchema=z.strictObject({caseId:z.uuid()});
export const caseListRequestSchema=z.strictObject({cursor:z.uuid().nullable(),workId:z.uuid().nullable()});
export type CaseCommand=z.infer<typeof caseCommandSchema>;
export type CaseView=z.infer<typeof caseReadSchema>;
export type CaseList=z.infer<typeof caseListSchema>;

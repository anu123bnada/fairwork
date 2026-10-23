import { z } from "zod";
import { workPayloadSchema,workReceiptSchema,workState } from "./schema";
const guarded={workId:z.uuid(),idempotencyKey:z.uuid(),expectedVersion:z.number().int().positive(),expectedHash:z.string().regex(/^[0-9a-f]{64}$/),expectedEvidenceHash:z.string().regex(/^[0-9a-f]{64}$/),expectedState:workState,reason:z.string().trim().min(1).max(2000)};
export const integrityCommandSchema=z.discriminatedUnion("operation",[
 z.strictObject({...guarded,operation:z.literal("withdraw")}),
 z.strictObject({...guarded,operation:z.literal("retract")}),
 z.strictObject({...guarded,operation:z.literal("correct"),agreementVersion:z.number().int().positive(),payload:workPayloadSchema}),
]);
export const integrityReceiptSchema=workReceiptSchema.extend({operation:z.enum(["withdraw","correct","retract"])});
export type IntegrityCommand=z.infer<typeof integrityCommandSchema>;

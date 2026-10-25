import { z } from "zod";
import { assessmentSchema } from "./assessment";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const analysisSaveRequest = z.strictObject({ offerId: z.uuid(), idempotencyKey: z.uuid() });
export const analysisReceipt = z.strictObject({ id: z.uuid(), saved: z.literal(true) });
export const analysisItem = z.strictObject({
 id: z.uuid(), offerVersion: z.number().int().positive(), termHash: hash, engine: z.literal("offer-indicators.v1"),
 score: z.number().int().min(0).max(100), result: assessmentSchema, savedAt: z.string(),
});
export const analysisList = z.strictObject({ offerId: z.uuid(), items: z.array(analysisItem).max(20) });
export type AnalysisList = z.infer<typeof analysisList>;

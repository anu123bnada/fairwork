import { z } from "zod";
export const offerDecision = z.enum(["considering", "interested", "accepted", "declined"]);
export const offerLifecycleRequest = z.strictObject({
  offerId: z.uuid(), archived: z.boolean(), decision: offerDecision,
  expectedRevision: z.number().int().min(0).max(999999999), idempotencyKey: z.uuid(),
});
export const offerLifecycleResult = z.strictObject({ saved: z.literal(true), revision: z.number().int().positive() });

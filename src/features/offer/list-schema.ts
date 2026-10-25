import { z } from "zod";
import { offerDecision } from "./lifecycle-schema";
export const offerListRequestSchema = z.strictObject({
  context: z.enum(["WORKER", "EMPLOYER"]).default("WORKER"),
  cursor: z.uuid().nullable().default(null),
  view: z.enum(["active", "archived", "all"]).optional(),
});
export const offerListSchema = z.strictObject({
  items: z.array(z.strictObject({
    offerId: z.uuid(), companyId: z.uuid(), version: z.number().int().positive(),
    role: z.string().nullable(), createdAt: z.string(), questions: z.number().int().nonnegative(),
    archived: z.boolean().optional(), decision: offerDecision.optional(), lifecycleRevision: z.number().int().nonnegative().optional(),
  })).max(20),
  nextCursor: z.uuid().nullable(),
});
export type OfferList = z.infer<typeof offerListSchema>;

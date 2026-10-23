import { z } from "zod";
export const offerListRequestSchema = z.strictObject({
  context: z.enum(["WORKER", "EMPLOYER"]).default("WORKER"),
  cursor: z.uuid().nullable().default(null),
});
export const offerListSchema = z.strictObject({
  items: z.array(z.strictObject({
    offerId: z.uuid(), companyId: z.uuid(), version: z.number().int().positive(),
    role: z.string().nullable(), createdAt: z.string(), questions: z.number().int().nonnegative(),
  })).max(20),
  nextCursor: z.uuid().nullable(),
});
export type OfferList = z.infer<typeof offerListSchema>;

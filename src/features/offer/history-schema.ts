import { z } from "zod";
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const term = z.union([z.string(), z.number().finite()]);
export const offerHistoryRequest = z.strictObject({
  offerId: z.uuid(),
  beforeVersion: z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(version).nullable().default(null),
});
export const offerHistorySchema = z.strictObject({
  offerId: z.uuid(), items: z.array(z.strictObject({
    version, recordedAt: z.iso.datetime({ offset: true }), termHash: z.string().regex(/^[a-f0-9]{64}$/),
    snapshot: z.record(z.string(), term),
    changes: z.array(z.strictObject({ field: z.string(), previous: term.nullable(), current: term.nullable() })),
  })).max(20), nextCursor: version.nullable(),
});
export type OfferHistory = z.infer<typeof offerHistorySchema>;

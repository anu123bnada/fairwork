import { z } from "zod";

// A person's private record of listings they saved and why each had been shown to them (module 3). Only criterion ids and outcomes are kept, never listing text,
// pay figures or the person's own preference values.
export const recommendationHistoryLimit = 50;
export const recommendationReason = z.strictObject({ id: z.enum(["role", "location", "workMode", "pay", "payUnknown"]), outcome: z.enum(["matches", "differs", "unknown"]) });
export const recommendationHistoryEntry = z.strictObject({
  entryId: z.uuid(), listingId: z.uuid(), listingTitle: z.string().min(1).max(120), companyName: z.string().min(1).max(300).nullable(),
  preferenceVersion: z.number().int().min(0), reasons: z.array(recommendationReason).max(5), createdAt: z.string(),
});
export const recommendationHistoryList = z.strictObject({ items: z.array(recommendationHistoryEntry).max(recommendationHistoryLimit) });
export const recommendationHistoryAddInput = z.strictObject({
  listingId: z.uuid(), listingTitle: z.string().trim().min(1).max(120), companyName: z.string().min(1).max(300).nullable(),
  preferenceVersion: z.number().int().min(0), reasons: z.array(recommendationReason).max(5),
});
export const recommendationHistoryAdded = z.strictObject({ entryId: z.uuid(), replayed: z.boolean() });
export const recommendationHistoryDeleteInput = z.strictObject({ entryId: z.uuid() });
export const recommendationHistoryDeleted = z.strictObject({ entryId: z.uuid() });
export type RecommendationHistoryEntry = z.infer<typeof recommendationHistoryEntry>;

import { z } from "zod";

// A person's private record of company searches they ran (module 02): what they asked, how many public-registry records matched, the best match, and when it was retrieved.
export const researchHistoryLimit = 50;
export const researchHistoryEntry = z.strictObject({
  entryId: z.uuid(), queryName: z.string().min(1).max(200), queryCountry: z.string().regex(/^[A-Z]{2}$/).nullable(), totalMatches: z.number().int().min(0).max(100000),
  topLei: z.string().regex(/^[A-Z0-9]{20}$/).nullable(), topName: z.string().min(1).max(300).nullable(), topMatch: z.enum(["exact", "close", "partial", "weak", "none"]),
  source: z.string().min(1).max(80), retrievedAt: z.string(), createdAt: z.string(),
});
export const researchHistoryList = z.strictObject({ items: z.array(researchHistoryEntry).max(researchHistoryLimit) });
export const researchHistoryAdded = z.strictObject({ entryId: z.uuid(), replayed: z.boolean() });
export const researchHistoryDeleted = z.strictObject({ entryId: z.uuid() });
export const researchHistoryDeleteInput = z.strictObject({ entryId: z.uuid() });
export type ResearchHistoryEntry = z.infer<typeof researchHistoryEntry>;

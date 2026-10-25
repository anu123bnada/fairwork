import { z } from "zod";
export const draftContent = z.strictObject({ role: z.string().trim().min(1).max(120), employer: z.string().max(200), text: z.string().max(10000) });
export const draftSave = z.strictObject({ operation: z.literal("save"), id: z.uuid(), expectedRevision: z.number().int().min(0).max(999999999), idempotencyKey: z.uuid(), content: draftContent });
export const draftList = z.strictObject({ operation: z.literal("list"), cursor: z.uuid().nullable() });
export const draftReceipt = z.strictObject({ id: z.uuid(), revision: z.number().int().positive(), saved: z.literal(true) });
export const draftPage = z.strictObject({ items: z.array(z.strictObject({ id: z.uuid(), revision: z.number().int().positive(), content: draftContent, savedAt: z.string() })).max(20), nextCursor: z.uuid().nullable() });
export type DraftPage = z.infer<typeof draftPage>;

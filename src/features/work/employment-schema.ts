import { z } from "zod";
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const employmentContent = z.strictObject({
 employer: z.string().trim().min(1).max(200), role: z.string().trim().min(1).max(120),
 startDate: month, endDate: month.nullable(), current: z.boolean(),
 skills: z.array(z.string().trim().min(1).max(60)).max(20), achievements: z.string().max(2000),
}).refine(v => v.current ? v.endDate === null : v.endDate !== null && v.endDate >= v.startDate, { message: "Invalid employment dates" });
export const employmentSave = z.strictObject({ operation: z.literal("save"), id: z.uuid(), expectedRevision: z.number().int().min(0).max(999999999), idempotencyKey: z.uuid(), content: employmentContent });
export const employmentList = z.strictObject({ operation: z.literal("list"), cursor: z.uuid().nullable() });
export const employmentReceipt = z.strictObject({ id: z.uuid(), revision: z.number().int().positive(), saved: z.literal(true) });
export const employmentPage = z.strictObject({ items: z.array(z.strictObject({ id: z.uuid(), revision: z.number().int().positive(), content: employmentContent, savedAt: z.string(), verification: z.literal("self_reported") })).max(20), nextCursor: z.uuid().nullable() });
export type EmploymentPage = z.infer<typeof employmentPage>;

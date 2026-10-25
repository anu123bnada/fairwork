import { z } from "zod";
export const guidanceTopic = z.enum(["offer", "agreement", "evidence", "passport", "opportunities"]);
export const guidanceRead = z.strictObject({ operation: z.literal("read"), threadId: z.uuid().nullable() });
export const guidanceSend = z.strictObject({ operation: z.literal("send"), threadId: z.uuid(), question: z.string().trim().min(1).max(2000), topic: guidanceTopic, offerId: z.uuid().nullable(), idempotencyKey: z.uuid() });
export const guidancePage = z.strictObject({ threadId: z.uuid().nullable(), providerAvailable: z.literal(false), threads: z.array(z.strictObject({ id: z.uuid(), updatedAt: z.string() })).max(30), turns: z.array(z.strictObject({ ordinal: z.number().int().positive(), question: z.string(), topic: guidanceTopic, createdAt: z.string(), response: z.strictObject({ mode: z.literal("rules"), text: z.string(), source: z.literal("ORYQEN product guide"), sourceVersion: z.literal("guidance.v1"), destination: z.enum(["/app/home", "/app/work-record", "/app/passport", "/app/opportunities"]), context: z.strictObject({ offerId: z.uuid(), version: z.number().int().positive(), openQuestions: z.number().int().nonnegative() }).nullable() }) })).max(100) });
export type GuidancePage = z.infer<typeof guidancePage>;
export const guidanceDelete = z.strictObject({ operation: z.literal("delete"), threadId: z.uuid() });
export const guidanceDeleteReceipt = z.strictObject({ threadId: z.uuid(), deleted: z.number().int().min(0).max(100) });
export const guidanceCommand = z.discriminatedUnion("operation", [guidanceSend, guidanceDelete]);

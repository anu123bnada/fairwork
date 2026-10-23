import { z } from "zod";
export const privacyKind = z.enum(["access", "correction", "deactivation", "deletion"]);
export const privacyStatus = z.enum(["received", "in_review", "needs_information", "fulfilled", "declined", "withdrawn"]);
export const privacyQuery = z.union([
 z.strictObject({ requestId: z.uuid() }),
 z.strictObject({ cursor: z.uuid().nullable().default(null) }),
]);
export const privacyCreate = z.strictObject({ operation: z.literal("create"), kind: privacyKind, scope: z.string().trim().min(1).max(500) });
export const privacyWithdraw = z.strictObject({ operation: z.literal("withdraw"), requestId: z.uuid(), expectedRevision: z.number().int().min(0).max(19) });
export const privacyCommand = z.discriminatedUnion("operation", [privacyCreate, privacyWithdraw]);
export const privacyReview = z.strictObject({
 operation: z.literal("review"), requestId: z.uuid(), expectedRevision: z.number().int().min(0).max(19),
 status: z.enum(["in_review", "needs_information", "fulfilled", "declined"]), note: z.string().trim().min(1).max(500),
 evidenceRef: z.string().trim().min(10).max(200).nullable(),
}).refine(value => (value.status === "fulfilled") === (value.evidenceRef !== null))
 .refine(value => value.expectedRevision < 19 || value.status === "fulfilled" || value.status === "declined");
export const privacyRequest = z.strictObject({
 requestId: z.uuid(), kind: privacyKind, scope: z.string().max(500), createdAt: z.iso.datetime({ offset: true }),
 revision: z.number().int().min(0).max(20), status: privacyStatus,
 history: z.array(z.strictObject({ revision: z.number().int().positive(), status: privacyStatus.exclude(["received"]), note: z.string().max(500), evidenceRef: z.string().max(200).nullable(), recordedAt: z.iso.datetime({ offset: true }) })).max(20),
});
export const privacyList = z.strictObject({ items: z.array(privacyRequest).max(20), nextCursor: z.uuid().nullable() });
export type PrivacyRequest = z.infer<typeof privacyRequest>;

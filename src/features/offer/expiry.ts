import { z } from "zod";

// Expiry date of a proposed agreement version (modules 05 and 20). Set and renewed by the worker who proposed it; readable by both participants.
export const expiryMaxDays = 365;
export const expirySetInput = z.strictObject({ agreementId: z.uuid(), expectedVersion: z.number().int().min(1).max(999999), expiresAt: z.iso.datetime({ offset: true }) });
export const expiryRead = z.strictObject({ agreementId: z.uuid(), version: z.number().int(), expiresAt: z.string().nullable(), expired: z.boolean(), renewals: z.number().int(), canSet: z.boolean() });
export const expirySet = z.strictObject({ agreementId: z.uuid(), version: z.number().int(), expiresAt: z.string(), renewals: z.number().int(), replayed: z.boolean() });
export const expiryList = z.strictObject({ items: z.array(z.strictObject({ agreementId: z.uuid(), version: z.number().int(), expiresAt: z.string(), expired: z.boolean(), role: z.enum(["worker", "representative"]) })).max(50) });
export type ExpiryRead = z.infer<typeof expiryRead>;
export type ExpiryListItem = z.infer<typeof expiryList>["items"][number];

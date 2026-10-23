import { z } from "zod";
export const deactivationInput = z.strictObject({expectedRevision:z.number().int().min(1).max(999999999999999),confirmation:z.literal("DEACTIVATE")});
export const deactivationReceipt = z.strictObject({deactivated:z.literal(true),recordedAt:z.string(),revision:z.number().int().min(2)});
export const accountAccess = z.strictObject({access:z.enum(["active","needs_profile","disabled"])});

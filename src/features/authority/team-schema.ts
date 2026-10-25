import { z } from "zod";
export const teamQuery = z.strictObject({ companyId: z.uuid() });
export const teamMember = z.strictObject({
  self: z.boolean(), role: z.literal("representative"), status: z.enum(["active", "pending", "expired", "revoked"]),
  effectiveAt: z.string(), expiresAt: z.string().nullable(),
});
export const teamRoster = z.strictObject({ companyId: z.uuid(), members: z.array(teamMember).max(100), changeProcess: z.literal("operator_reviewed") });
export type TeamRoster = z.infer<typeof teamRoster>;

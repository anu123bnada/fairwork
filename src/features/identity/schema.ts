import { z } from "zod";

const displayFields = {
  displayName: z.string().trim().min(1).max(80),
  locale: z.literal("en"),
  timeZone: z.string().min(1).max(64).refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }),
};
export const createProfileSchema = z.strictObject(displayFields);
export const updateProfileSchema = z.strictObject({ ...displayFields, expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) });
export const signInSchema = z.strictObject({ email: z.email().max(254), password: z.string().min(1).max(1024) });
export const emptyRequestSchema = z.strictObject({});
export const capabilitySchema = z.enum(["authority_operator", "review_operator", "reviewer", "privacy_operator"]);
export type Capability = z.infer<typeof capabilitySchema>;
export const meSchema = z.strictObject({
  id: z.uuid(), displayName: z.string(), locale: z.literal("en"), timeZone: z.string(), revision: z.number().int().min(1),
  capabilities: z.array(capabilitySchema),
});
export type Me = z.infer<typeof meSchema>;
export type RoleContext = "WORKER" | "EMPLOYER" | "ADMIN";
// Context names are presentation vocabulary, not credentials. Employer authority
// requires a verified membership DTO; merely having a membership table does not
// authorize the client to infer employer access.
export function availableContexts(me: Me): RoleContext[] {
  return me.capabilities.length ? ["WORKER", "ADMIN"] : ["WORKER"];
}

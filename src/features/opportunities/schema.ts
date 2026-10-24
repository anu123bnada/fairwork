import { z } from "zod";
export const workMode = z.enum(["onsite", "hybrid", "remote"]);
export const payPeriod = z.enum(["hour", "month", "year"]);
const money = z.number().finite().min(0).max(1000000000);
export const listingFields = z.strictObject({
  title: z.string().trim().min(2).max(120), description: z.string().trim().min(10).max(3000),
  location: z.string().trim().min(2).max(120), workMode, salary: money.nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/), payPeriod,
});
export const preferencesSchema = z.strictObject({
  role: z.string().trim().max(120), location: z.string().trim().max(120),
  workMode: workMode.nullable(), minimumPay: money.nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/), payPeriod,
});
export const defaultPreferences: z.infer<typeof preferencesSchema> = { role: "", location: "", workMode: null, minimumPay: null, currency: "LKR", payPeriod: "month" };
export const opportunityQuery = z.strictObject({ view: z.enum(["discover", "mine", "saved", "hidden"]).default("discover"), query: z.string().trim().max(120).default(""), cursor: z.uuid().nullable().default(null) });
export const opportunityCommand = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("listing"), id: z.uuid(), companyId: z.uuid(), expectedVersion: z.number().int().nonnegative(), fields: listingFields, status: z.enum(["draft", "published", "closed"]), expiresAt: z.iso.datetime(), idempotencyKey: z.uuid() }),
  z.strictObject({ operation: z.literal("preferences"), preferences: preferencesSchema, expectedVersion: z.number().int().nonnegative(), idempotencyKey: z.uuid() }),
  z.strictObject({ operation: z.literal("choice"), id: z.uuid(), choice: z.enum(["saved", "hidden", "none"]), idempotencyKey: z.uuid() }),
]);
export const opportunityItem = z.strictObject({ id: z.uuid(), companyId: z.uuid(), companyName: z.string().nullable(), version: z.number().int().positive(), fields: listingFields, status: z.enum(["draft", "published", "closed"]), expiresAt: z.string(), updatedAt: z.string(), choice: z.enum(["saved", "hidden", "none"]), canEdit: z.boolean(), source: z.literal("representative_submission"), assurance: z.literal("demo_provisioned") });
export const opportunityPage = z.strictObject({ items: z.array(opportunityItem).max(20), nextCursor: z.uuid().nullable(), preferences: preferencesSchema.nullable(), preferenceVersion: z.number().int().nonnegative() });
export type Opportunity = z.infer<typeof opportunityItem>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type OpportunityPage = z.infer<typeof opportunityPage>;

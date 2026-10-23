import { z } from "zod";
export const companyClaimsSchema = z.strictObject({
 description: z.string().trim().max(500), location: z.string().trim().max(500), industry: z.string().trim().max(500),
 website: z.string().max(400).refine(v => v === "" || /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?(\/[^\s]*)?$/.test(v)),
});
export const companySaveSchema = z.strictObject({ companyId: z.uuid(), expectedVersion: z.number().int().min(0).max(999999999), claims: companyClaimsSchema });
export const companyReadSchema = z.strictObject({ companyId: z.uuid() });
export const companySearchSchema = z.strictObject({ query: z.string().trim().max(120).default("") });
export const companyProfileSchema = z.strictObject({ companyId: z.uuid(), companyName: z.string().nullable(), canEdit: z.boolean(), assurance: z.literal("demo_provisioned"), sourceType: z.literal("representative_claim"), verification: z.literal("unverified"), history: z.array(z.strictObject({ version: z.number().int().positive(), claims: companyClaimsSchema, submittedAt: z.string() })).max(10) });
export const companyResultsSchema = z.strictObject({ items: z.array(z.strictObject({ companyId: z.uuid(), name: z.string().nullable() })).max(20), scope: z.literal("your_authorized_organizations"), externalSourceConfigured: z.literal(false) });
export type CompanyProfile = z.infer<typeof companyProfileSchema>;

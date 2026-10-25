import { z } from "zod";

// Normalized third-party registry evidence. Every record carries its provider, a citable URL
// and the time it was retrieved; nothing here is employer-submitted or AI-generated.
export const registryRecord = z.strictObject({
  provider: z.literal("gleif"),
  providerName: z.literal("GLEIF Global LEI Index"),
  identifier: z.strictObject({ scheme: z.literal("LEI"), value: z.string().regex(/^[A-Z0-9]{20}$/) }),
  legalName: z.string().min(1).max(300),
  otherNames: z.array(z.string().max(300)).max(10),
  country: z.string().regex(/^[A-Z]{2}$/).nullable(),
  jurisdiction: z.string().max(20).nullable(),
  legalForm: z.string().max(200).nullable(),
  entityStatus: z.string().max(40),
  registrationStatus: z.string().max(40),
  corroboration: z.string().max(40).nullable(),
  registrationAuthority: z.strictObject({ id: z.string().max(40).nullable(), entityId: z.string().max(100).nullable() }),
  legalAddress: z.string().max(400).nullable(),
  sourceLastUpdated: z.string().nullable(),
  nextRenewal: z.string().nullable(),
  sourceUrl: z.url(),
  retrievedAt: z.string(),
});
export type RegistryRecord = z.infer<typeof registryRecord>;

export const finding = z.strictObject({
  id: z.string().max(60),
  kind: z.enum(["supports", "contradicts", "outdated", "info", "limitation"]),
  title: z.string().max(200),
  detail: z.string().max(700),
});
export type Finding = z.infer<typeof finding>;

export const freshness = z.strictObject({
  status: z.enum(["current", "aging", "stale", "unknown"]),
  sourceAgeDays: z.number().int().nonnegative().nullable(),
  verifyAgainBy: z.string().nullable(),
});

export const researchResult = z.strictObject({
  record: registryRecord,
  nameMatch: z.enum(["exact", "close", "partial", "weak"]),
  freshness,
  findings: z.array(finding).max(12),
});
export type ResearchResult = z.infer<typeof researchResult>;

export const researchQuery = z.strictObject({
  name: z.string().trim().min(2).max(120),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
});
export const researchResponse = z.strictObject({
  query: z.strictObject({ name: z.string(), country: z.string().nullable() }),
  results: z.array(researchResult).max(10),
  totalMatches: z.number().int().nonnegative(),
  source: z.strictObject({ provider: z.literal("gleif"), name: z.string(), url: z.url(), kind: z.literal("third_party_registry") }),
  limitations: z.array(z.string().max(500)).min(1).max(6),
});
export type ResearchResponse = z.infer<typeof researchResponse>;

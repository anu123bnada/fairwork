import { z } from "zod";

// Browser-safe shapes for developer access (no Node-only imports, so client components can use them).
export const developerScopes = ["credentials:verify"] as const;
export type DeveloperScope = (typeof developerScopes)[number];

export const developerKeyLabel = z.strictObject({ label: z.string().trim().min(1).max(60) });
export const developerKeyRow = z.strictObject({
  keyId: z.uuid(), label: z.string(), scopes: z.array(z.enum(developerScopes)), createdAt: z.string(), revokedAt: z.string().nullable(), callsLast24h: z.number().int().nonnegative(),
});
export const developerKeyList = z.strictObject({ items: z.array(developerKeyRow).max(20) });
export const developerKeyCreated = z.strictObject({ keyId: z.uuid(), scopes: z.array(z.enum(developerScopes)) });
export const developerKeyCheck = z.strictObject({ valid: z.boolean(), scopes: z.array(z.enum(developerScopes)) });
export const verifyRequest = z.strictObject({ credential: z.string().min(100).max(4096) });

export const webhookUrl = z.string().trim().max(300).regex(/^https:\/\//, "Webhook addresses must use https");
export const webhookCreateRequest = z.strictObject({ url: webhookUrl });
export const webhookRow = z.strictObject({
  webhookId: z.uuid(), url: z.string(), createdAt: z.string(),
  lastDelivery: z.strictObject({ at: z.string(), outcome: z.enum(["delivered", "failed"]), statusCode: z.number().int().nullable(), eventType: z.enum(["ping", "credential.revoked"]), attempt: z.number().int() }).nullable(),
});
export const webhookList = z.strictObject({ items: z.array(webhookRow).max(3) });
export const webhookCreated = z.strictObject({ webhookId: z.uuid(), url: z.string() });
export const webhookTargets = z.strictObject({ items: z.array(z.strictObject({ webhookId: z.uuid(), url: z.string(), secret: z.string() })).max(3) });

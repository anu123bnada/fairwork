import "server-only";
import { z } from "zod";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { CredentialError, issueCredential } from "@/features/credentials/core";
import { workRecordClaims } from "@/features/trust/build";
import type { WorkRecord } from "@/features/work/schema";
import type { CredentialConfig } from "./config";

export const issueRequest = z.strictObject({
  workId: z.uuid(),
  lifetimeDays: z.number().int().min(1).max(365).default(90),
  statement: z.string().trim().min(1).max(300).optional(),
  idempotencyKey: z.uuid(),
});
export const revokeRequest = z.strictObject({ credentialId: z.uuid() });
export const issuedCredential = z.strictObject({ credentialId: z.uuid(), token: z.string(), expiresAt: z.string(), replayed: z.boolean() });
export const credentialRow = z.strictObject({
  credentialId: z.uuid(), sourceId: z.uuid(), sourceVersion: z.number().int().positive(), assurance: z.literal("independently_reviewed"),
  issuedAt: z.string(), expiresAt: z.string(), token: z.string(), status: z.enum(["valid", "revoked", "expired", "unknown"]), reason: z.enum(["holder_requested", "source_changed"]).nullable(),
});
export const credentialListResponse = z.strictObject({ items: z.array(credentialRow).max(50) });
export const statusResponse = z.strictObject({ status: z.enum(["valid", "revoked", "expired", "unknown"]), reason: z.enum(["holder_requested", "source_changed"]).nullable(), checkedAt: z.string() });

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
export type IssueDeps = { rpc: Rpc; readWork: (workId: string) => Promise<WorkRecord>; userId: string; config: CredentialConfig | null; now: Date; uuid: () => string };

// Issues one credential for the caller's own verified work record. The claim is recomputed here from the
// authorized record, never taken from the browser, and the database re-checks ownership, state and the
// content-bound claim reference before the credential is registered.
export async function issueForWorkRecord(input: z.infer<typeof issueRequest>, deps: IssueDeps) {
  if (!deps.config) throw new AppError("SERVICE_UNAVAILABLE", 503);
  const record = await deps.readWork(input.workId);
  if (record.workerId !== deps.userId) throw new AppError("ACTION_FORBIDDEN", 403);
  const claim = workRecordClaims([record])[0];
  if (!claim) throw new AppError("NOT_FOUND", 404);
  const credentialId = deps.uuid();
  let issued;
  try {
    issued = await issueCredential({ claim, statement: input.statement, issuer: deps.config.issuer, statusUrl: deps.config.statusUrl, now: deps.now, lifetimeDays: input.lifetimeDays, credentialId, subjectRef: deps.uuid(), kid: deps.config.keyId }, deps.config.privateJwk);
  } catch (error) {
    if (error instanceof CredentialError) throw error.code === "not_eligible" ? new AppError("ACTION_FORBIDDEN", 403) : new AppError("VALIDATION_FAILED", 422);
    throw new AppError("SERVICE_UNAVAILABLE", 503);
  }
  const { data, error } = await deps.rpc("credential_register", {
    credentialId, sourceId: claim.source.id, sourceVersion: claim.source.version, claimRef: claim.claimId, assurance: "independently_reviewed",
    expiresAt: new Date(issued.payload.exp * 1000).toISOString(), keyId: deps.config.keyId, token: issued.jws, idempotencyKey: input.idempotencyKey,
  });
  if (error) throw mapDatabaseError(error);
  const parsed = issuedCredential.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return { ...parsed.data, verifyUrl: `${deps.config.verifyBase}#c=${parsed.data.token}` };
}

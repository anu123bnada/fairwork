import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { verifyCredential } from "@/features/credentials/core";
import { statusResponse } from "@/server/credentials/issue";
import type { CredentialConfig } from "@/server/credentials/config";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

// Full server-side verification for an integrator: the signature against the published keys, then the live status.
// The answer carries only what the credential itself already disclosed to whoever holds it; nothing about the account.
export async function verifyForIntegrator(token: string, deps: { config: CredentialConfig | null; rpc: Rpc; now: Date }) {
  if (!deps.config) throw new AppError("SERVICE_UNAVAILABLE", 503);
  const result = await verifyCredential(token, { issuer: deps.config.issuer, publicKeys: deps.config.publicKeys, now: deps.now });
  if (!result.valid) return { valid: false as const, state: "not_verified" as const, reason: result.reason };
  const { data, error } = await deps.rpc("credential_status", { credentialId: result.payload.jti });
  if (error) throw mapDatabaseError(error);
  const status = statusResponse.safeParse(data);
  if (!status.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return {
    valid: status.data.status === "valid", state: status.data.status, reason: status.data.reason, checkedAt: status.data.checkedAt,
    credential: {
      id: result.payload.jti, statement: result.payload.claim.statement, claimType: result.payload.claim.type, assurance: result.payload.claim.assurance,
      assuranceAt: result.payload.claim.assuranceAt, caveat: result.payload.claim.caveat,
      issuedAt: new Date(result.payload.iat * 1000).toISOString(), expiresAt: new Date(result.payload.exp * 1000).toISOString(), issuer: result.payload.iss,
    },
  };
}

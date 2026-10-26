import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { developerKeyCheck, parseDeveloperKey, type DeveloperScope } from "@/features/developer/keys";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

// Authenticates a developer key and requires a scope. Every failure (missing, malformed, wrong secret, revoked key, missing
// scope) answers the same 401, so the response teaches an attacker nothing about which keys exist. The per-minute ceiling
// answers 429 and is enforced by the database.
export async function authenticateDeveloper(request: Request, scope: DeveloperScope, rpc: Rpc) {
  const key = parseDeveloperKey(request.headers.get("authorization"));
  if (!key) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await rpc("developer_key_check", { keyId: key.keyId, secretHash: key.secretHash });
  if (error) throw mapDatabaseError(error);
  const parsed = developerKeyCheck.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (!parsed.data.valid || !parsed.data.scopes.includes(scope)) throw new AppError("AUTH_REQUIRED", 401);
  return { keyId: key.keyId, scopes: parsed.data.scopes };
}

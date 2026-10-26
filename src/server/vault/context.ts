import "server-only";
import { createServerSupabase } from "@/server/supabase";
import { getServerEnvironment } from "@/server/env";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { vaultStoreFromEnv } from "./store";
import type { VaultDeps } from "./service";
import type { Json } from "@/types/database";

// Signed-in caller, a database-backed RPC runner under the caller's own session, and the configured store (or null).
export async function vaultContext(): Promise<VaultDeps> {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  return {
    userId: data.user.id,
    rpc: async (name, request) => client.rpc(name as "vault_list", { request: request as Json }),
    store: vaultStoreFromEnv(getServerEnvironment().origin),
  };
}

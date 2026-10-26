import "server-only";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { Json } from "@/types/database";

// A signed-in, non-anonymous caller and an RPC runner under that caller's own session.
export async function signedInClient() {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const rpc = async (name: string, request: Record<string, unknown>) => client.rpc(name as "webhook_list", { request: request as Json });
  return { client, rpc, userId: data.user.id };
}

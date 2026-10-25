
import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { meSchema } from "@/features/identity/schema";
import type { Json } from "@/types/database";

export async function identityCommand(
  command: "get_me" | "create_profile" | "update_profile",
  request: Json
) {
  const supabase = await createServerSupabase(true);

  const { data: identity, error: authError } =
    await supabase.auth.getUser();

  if (authError && (authError.status ?? 0) >= 500) {
    throw new AppError("SERVICE_UNAVAILABLE", 503);
  }

  if (authError || !identity.user || identity.user.is_anonymous) {
    throw new AppError("AUTH_REQUIRED", 401);
  }

  const { data, error } = await supabase.rpc(command, { request });

  if (error) {
    console.error(
      "[ORYQEN_PROFILE_RPC_DIAGNOSTIC]",
      JSON.stringify({
        command,
        code: error.code ?? null,
        status: "status" in error ? error.status : null,
      })
    );

    throw mapDatabaseError(error);
  }

  const result = meSchema.safeParse(data);

  if (!result.success) {
    throw new AppError("INTERNAL_ERROR", 500);
  }

  return result.data;
}

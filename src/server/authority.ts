import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { companyResult, membershipResult } from "@/features/authority/schema";
import type { Json } from "@/types/database";

export async function authorityCommand(command: "provision_company" | "decide_membership", request: Json) {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  // The database verifies aal2, active profile and protected capability, including
  // direct PostgREST requests which do not pass through this route.
  const result = await client.rpc(command, { request });
  if (result.error) throw mapDatabaseError(result.error);
  const parsed = (command === "provision_company" ? companyResult : membershipResult).safeParse(result.data);
  if (!parsed.success) throw new AppError("INTERNAL_ERROR", 500);
  return parsed.data;
}

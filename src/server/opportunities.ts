import "server-only";
import { z } from "zod";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { opportunityPage } from "@/features/opportunities/schema";
import type { Json } from "@/types/database";
export async function opportunities(command: "opportunity_read" | "opportunity_command", request: Json) {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const result = await client.rpc(command, { request });
  if (result.error) throw mapDatabaseError(result.error);
  const parsed = (command === "opportunity_read" ? opportunityPage : z.strictObject({ saved: z.literal(true) })).safeParse(result.data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}

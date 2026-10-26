import "server-only";
import { z } from "zod";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { opportunityPage } from "@/features/opportunities/schema";
import { enforceListingLimit } from "./entitlements";
import type { Json } from "@/types/database";
export async function opportunities(command: "opportunity_read" | "opportunity_command", request: Json) {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  // A listing that becomes live must fit the organization's plan. The database stays the authority on who may publish; this only counts.
  if (command === "opportunity_command" && request && typeof request === "object" && !Array.isArray(request) && request.operation === "listing" && request.status === "published" && typeof request.companyId === "string" && typeof request.id === "string") {
    await enforceListingLimit(async (name, payload) => client.rpc(name as "org_entitlement_read", { request: payload as Json }), request.companyId, request.id);
  }
  const result = await client.rpc(command, { request });
  if (result.error) throw mapDatabaseError(result.error);
  const parsed = (command === "opportunity_read" ? opportunityPage : z.strictObject({ saved: z.literal(true) })).safeParse(result.data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}

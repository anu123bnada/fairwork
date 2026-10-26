import { z } from "zod";
import { apiResponse } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { orgEntitlementSummary } from "@/server/entitlements";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

// An organization's plan and listing usage, for its approved representatives. Anyone else is refused by the database.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const company = z.uuid().safeParse(query.get("companyId"));
    if (!company.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    return orgEntitlementSummary(async (name, payload) => client.rpc(name as "org_entitlement_read", { request: payload as Json }), company.data);
  }, "org-entitlements.v1");
}

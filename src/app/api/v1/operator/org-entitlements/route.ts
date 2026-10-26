import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { assignOrgPlan } from "@/server/entitlements";
import { orgEntitlementAssignRequest, orgEntitlementAssigned } from "@/features/entitlements/catalog";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

// Operator-only organization plan assignment. The database requires the authority_operator capability and a second factor,
// refuses operators who hold authority in the organization, and keeps an append-only history.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, orgEntitlementAssignRequest);
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    const result = orgEntitlementAssigned.safeParse(await assignOrgPlan(async (name, payload) => client.rpc(name as "org_entitlement_assign", { request: payload as Json }), input));
    if (!result.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return result.data;
  }, "org-entitlement-assignment.v1");
}

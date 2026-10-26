import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { assignPlan } from "@/server/entitlements";
import { entitlementAssignRequest, entitlementAssigned } from "@/features/entitlements/catalog";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

// Operator-only plan assignment. The database requires the authority_operator capability and a second
// factor, refuses self-assignment, and keeps an append-only history.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, entitlementAssignRequest);
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    const result = entitlementAssigned.safeParse(await assignPlan(async (name, payload) => client.rpc(name as "entitlement_assign", { request: payload as Json }), input));
    if (!result.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return result.data;
  }, "entitlement-assignment.v1");
}

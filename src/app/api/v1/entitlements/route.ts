import { apiResponse } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { entitlementSummary } from "@/server/entitlements";
import { credentialListResponse } from "@/server/credentials/issue";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams.keys()].length) throw new AppError("VALIDATION_FAILED", 422);
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    const rpc = async (name: string, payload: Record<string, unknown>) => client.rpc(name as "entitlement_read", { request: payload as Json });
    const listed = await client.rpc("credential_list", { request: {} });
    if (listed.error) throw mapDatabaseError(listed.error);
    const parsed = credentialListResponse.safeParse(listed.data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return entitlementSummary(rpc, { activeCredentials: parsed.data.items.filter(item => item.status === "valid").length });
  }, "entitlements.v1");
}

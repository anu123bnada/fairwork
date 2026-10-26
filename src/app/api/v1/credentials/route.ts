import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { workService } from "@/server/work";
import { getServerEnvironment } from "@/server/env";
import { credentialConfig } from "@/server/credentials/config";
import { credentialListResponse, issueForWorkRecord, issueRequest } from "@/server/credentials/issue";
import { enforceLimit, readPlan } from "@/server/entitlements";
import { checkLimit } from "@/features/entitlements/catalog";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { WorkRecord } from "@/features/work/schema";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

async function session() {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  return { client, userId: data.user.id };
}

export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams.keys()].length) throw new AppError("VALIDATION_FAILED", 422);
    const { client } = await session();
    const config = credentialConfig(getServerEnvironment().origin);
    const { data, error } = await client.rpc("credential_list", { request: {} });
    if (error) throw mapDatabaseError(error);
    const parsed = credentialListResponse.safeParse(data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    // `signingConfigured` lets the interface explain why creating a credential is unavailable.
    const { plan } = await readPlan(async (name, payload) => client.rpc(name as "entitlement_read", { request: payload as Json }));
    const usage = checkLimit(plan, "activeCredentials", parsed.data.items.filter(item => item.status === "valid").length);
    const allowance = { planName: plan.name, limit: usage.limit, used: usage.used, remaining: usage.remaining };
    return { signingConfigured: config !== null, verifyBase: `${getServerEnvironment().origin}/verify`, items: parsed.data.items, allowance };
  }, "credentials.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, issueRequest);
    const { client, userId } = await session();
    const config = credentialConfig(getServerEnvironment().origin);
    if (!config) throw new AppError("SERVICE_UNAVAILABLE", 503); // nothing to meter or sign without a key
    // The free plan allows fewer active credentials than the hard database cap; a retry of an already-issued
    // credential at the limit is refused here, and the holder can revoke one to make room.
    const listed = await client.rpc("credential_list", { request: {} });
    if (listed.error) throw mapDatabaseError(listed.error);
    const current = credentialListResponse.safeParse(listed.data);
    if (!current.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    const { plan } = await readPlan(async (name, payload) => client.rpc(name as "entitlement_read", { request: payload as Json }));
    enforceLimit(plan, "activeCredentials", current.data.items.filter(item => item.status === "valid").length);
    return issueForWorkRecord(input, {
      rpc: async (name, payload) => client.rpc(name as "credential_register", { request: payload as Json }),
      readWork: async workId => await workService({ workId }) as WorkRecord,
      userId, config, now: new Date(), uuid: () => crypto.randomUUID(),
    });
  }, "credentials.v1");
}

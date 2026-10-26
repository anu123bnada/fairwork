import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { workService } from "@/server/work";
import { getServerEnvironment } from "@/server/env";
import { credentialConfig } from "@/server/credentials/config";
import { credentialListResponse, issueForWorkRecord, issueRequest } from "@/server/credentials/issue";
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
    return { signingConfigured: config !== null, verifyBase: `${getServerEnvironment().origin}/verify`, items: parsed.data.items };
  }, "credentials.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, issueRequest);
    const { client, userId } = await session();
    return issueForWorkRecord(input, {
      rpc: async (name, payload) => client.rpc(name as "credential_register", { request: payload as Json }),
      readWork: async workId => await workService({ workId }) as WorkRecord,
      userId, config: credentialConfig(getServerEnvironment().origin), now: new Date(), uuid: () => crypto.randomUUID(),
    });
  }, "credentials.v1");
}

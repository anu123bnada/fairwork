import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { developerKeyCreated, developerKeyLabel, developerKeyList, generateDeveloperKey } from "@/features/developer/keys";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
export const dynamic = "force-dynamic";

async function session() {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  return client;
}

export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams.keys()].length) throw new AppError("VALIDATION_FAILED", 422);
    const client = await session();
    const { data, error } = await client.rpc("developer_key_list", { request: {} });
    if (error) throw mapDatabaseError(error);
    const parsed = developerKeyList.safeParse(data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return parsed.data;
  }, "developer-keys.v1");
}

// The full key exists only in this response. It is generated here, only its hash is stored, and it cannot be shown again.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { label } = await readJson(request, developerKeyLabel);
    const client = await session();
    const generated = generateDeveloperKey();
    const { data, error } = await client.rpc("developer_key_create", { request: { keyId: generated.keyId, label, secretHash: generated.secretHash } });
    if (error) throw mapDatabaseError(error);
    const parsed = developerKeyCreated.safeParse(data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return { keyId: parsed.data.keyId, scopes: parsed.data.scopes, key: generated.key, note: "Copy this key now. It cannot be shown again." };
  }, "developer-keys.v1");
}

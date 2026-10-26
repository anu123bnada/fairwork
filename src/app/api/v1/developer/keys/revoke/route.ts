import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { keyId } = await readJson(request, z.strictObject({ keyId: z.uuid() }));
    const client = await createServerSupabase(true);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (isAuthServiceUnavailable(authError)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (authError || !auth.user || auth.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    const { data, error } = await client.rpc("developer_key_revoke", { request: { keyId } });
    if (error) throw mapDatabaseError(error);
    return data;
  }, "developer-keys.v1");
}

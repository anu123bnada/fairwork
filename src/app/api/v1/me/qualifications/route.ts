import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { qualificationCommand, qualificationList, qualificationPage, qualificationReceipt } from "@/features/qualifications/schema";
import { createServerSupabase } from "@/server/supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

// Private, self-reported qualification records. The database function (batch 7, section B) owns every rule: ownership, versioning, idempotency, and the derived
// verification label. Until that batch is approved and applied the function does not exist and this route answers 503, never an invented result.
async function execute(request: Json, save: boolean) {
  const client = await createServerSupabase(true);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (isAuthServiceUnavailable(authError)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await (client.rpc as unknown as (name: string, args: { request: Json }) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>)("qualifications", { request });
  if (error) throw mapDatabaseError(error);
  const parsed = (save ? qualificationReceipt : qualificationPage).safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    if (query.size > 1 || [...query.keys()].some(key => key !== "cursor")) throw new AppError("VALIDATION_FAILED", 422);
    const parsed = qualificationList.safeParse({ operation: "list", cursor: query.get("cursor") });
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", 422);
    return execute(parsed.data, false);
  }, "qualifications.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => { assertSameOrigin(request); return execute(await readJson(request, qualificationCommand), true); }, "qualifications.v1");
}

import { apiResponse } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { securityEvents } from "@/features/identity/security-events";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

// The caller's own recent sign-in, second-factor, sign-out and password-change events, newest first. No query parameters are accepted.
export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams].length > 0) throw new AppError("VALIDATION_FAILED", 422);
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    const result = await (client.rpc as unknown as (name: string, args: { request: Json }) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>)("security_events_list", { request: {} });
    if (result.error) throw mapDatabaseError(result.error);
    const parsed = securityEvents.safeParse(result.data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return parsed.data;
  }, "security-events.v1");
}

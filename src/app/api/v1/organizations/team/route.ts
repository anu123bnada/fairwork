import { apiResponse } from "@/server/http";
import { teamQuery, teamRoster } from "@/features/authority/team-schema";
import { createServerSupabase } from "@/server/supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const input = teamQuery.safeParse(Object.fromEntries(query));
    if (!input.success || query.size !== 1) throw new AppError("VALIDATION_FAILED", 422);
    const client = await createServerSupabase(true);
    const { data: identity, error: authError } = await client.auth.getUser();
    if (isAuthServiceUnavailable(authError)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    const { data, error } = await client.rpc("company_team", { request: input.data });
    if (error) throw mapDatabaseError(error);
    const parsed = teamRoster.safeParse(data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return parsed.data;
  }, "company-team.v1");
}

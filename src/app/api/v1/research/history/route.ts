import { apiResponse } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { listResearchHistory, rpcFor } from "@/server/research/history";
export const dynamic = "force-dynamic";

// The caller's own saved company searches, newest first.
export async function GET() {
  return apiResponse(async () => {
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    return listResearchHistory(rpcFor(client as never));
  }, "company-research.v1");
}

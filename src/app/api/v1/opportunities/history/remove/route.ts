import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { recommendationHistoryDeleteInput } from "@/features/opportunities/history";
import { deleteRecommendationHistory } from "@/server/opportunities/history";
import { rpcFor } from "@/server/research/history";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { entryId } = await readJson(request, recommendationHistoryDeleteInput);
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    return deleteRecommendationHistory(rpcFor(client as never), entryId);
  }, "opportunity-history.v1");
}

import { apiResponse, assertSameOrigin, idempotencyKey, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { recommendationHistoryAddInput } from "@/features/opportunities/history";
import { addRecommendationHistory, listRecommendationHistory } from "@/server/opportunities/history";
import { rpcFor } from "@/server/research/history";
export const dynamic = "force-dynamic";

async function signedIn() {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  return rpcFor(client as never);
}

// The caller's own saved-listing explanations, newest first. No query parameters are accepted.
export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams].length > 0) throw new AppError("VALIDATION_FAILED", 422);
    return listRecommendationHistory(await signedIn());
  }, "opportunity-history.v1");
}

// Records why a listing was shown when the person saved it. The idempotency key comes from the Idempotency-Key header (a UUID the client keeps for the save).
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const key = idempotencyKey(request);
    const entry = await readJson(request, recommendationHistoryAddInput);
    return addRecommendationHistory(await signedIn(), entry, key);
  }, "opportunity-history.v1");
}

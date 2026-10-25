import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { readAgreement } from "@/server/offer";
import { agreementReadRequestSchema } from "@/features/offer/read-schema";
import { assessOfferTerms } from "@/features/offer/assessment";
import { analysisList, analysisReceipt, analysisSaveRequest } from "@/features/offer/analysis-history-schema";
import { createServerSupabase } from "@/server/supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";
async function rpc(request: Json) {
  const client = await createServerSupabase(true);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (isAuthServiceUnavailable(authError)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await client.rpc("analysis_history", { request });
  if (error) throw mapDatabaseError(error);
  return data;
}
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const input = agreementReadRequestSchema.safeParse(Object.fromEntries(query));
    if (!input.success || query.size !== 1) throw new AppError("VALIDATION_FAILED", 422);
    const parsed = analysisList.safeParse(await rpc({ operation: "list", offerId: input.data.offerId }));
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return parsed.data;
  }, "analysis-history.v1");
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, analysisSaveRequest);
    // The analysis is recomputed here from the authorized offer. The browser never
    // supplies the result, version or hash that gets stored.
    const { offer } = await readAgreement({ offerId: input.offerId });
    if (offer.offerId !== input.offerId) throw new AppError("SERVICE_UNAVAILABLE", 503);
    const assessment = assessOfferTerms(offer.snapshot);
    const parsed = analysisReceipt.safeParse(await rpc({
      operation: "save", offerId: input.offerId, offerVersion: offer.version, termHash: offer.termHash,
      engine: assessment.version, score: assessment.score, result: assessment as unknown as Json, idempotencyKey: input.idempotencyKey,
    }));
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return parsed.data;
  }, "analysis-history.v1");
}

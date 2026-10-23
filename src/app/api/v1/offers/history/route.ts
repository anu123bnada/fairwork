import { apiResponse } from "@/server/http";
import { AppError } from "@/lib/errors";
import { offerHistoryRequest } from "@/features/offer/history-schema";
import { readOfferHistory } from "@/server/offer";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    if (query.size !== new Set(query.keys()).size) throw new AppError("VALIDATION_FAILED", 422);
    const input = offerHistoryRequest.safeParse(Object.fromEntries(query));
    if (!input.success) throw new AppError("VALIDATION_FAILED", 422);
    return readOfferHistory(input.data);
  }, "offer-history.v1");
}

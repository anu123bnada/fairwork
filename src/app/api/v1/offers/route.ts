import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { manualOfferRequestSchema } from "@/features/offer/schema";
import { listOffers, offerCommand } from "@/server/offer";
import { offerListRequestSchema } from "@/features/offer/list-schema";
import { AppError } from "@/lib/errors";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    if (query.size !== new Set(query.keys()).size) throw new AppError("VALIDATION_FAILED", 422);
    const input = offerListRequestSchema.safeParse(Object.fromEntries(query));
    if (!input.success) throw new AppError("VALIDATION_FAILED", 422);
    return listOffers(input.data);
  }, "offer-list.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, manualOfferRequestSchema);
    return offerCommand("review_offer", input as Json);
  }, "manual-offer.v1");
}

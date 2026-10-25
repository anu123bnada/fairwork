import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { offerLifecycleRequest } from "@/features/offer/lifecycle-schema";
import { updateOfferLifecycle } from "@/server/offer-lifecycle";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    return updateOfferLifecycle(await readJson(request, offerLifecycleRequest));
  }, "offer-lifecycle.v1");
}

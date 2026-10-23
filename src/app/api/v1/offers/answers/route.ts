import { answerOfferQuestionSchema } from "@/features/offer/schema";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { offerCommand } from "@/server/offer";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, answerOfferQuestionSchema);
    return offerCommand("answer_offer_question", input as Json);
  }, "offer-question-answer.v1");
}

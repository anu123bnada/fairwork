import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { agreementConfirmationSchema } from "@/features/offer/schema";
import { offerCommand, readAgreement } from "@/server/offer";
import { agreementReadRequestSchema } from "@/features/offer/read-schema";
import { AppError } from "@/lib/errors";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const input = agreementReadRequestSchema.safeParse(Object.fromEntries(query));
    if (!input.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return readAgreement(input.data);
  }, "manual-agreement-read.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, agreementConfirmationSchema);
    return offerCommand("confirm_agreement", input as Json);
  }, "manual-agreement.v1");
}

import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { attachOfferDocument, listOfferAttachments } from "@/server/vault/service";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const offer = z.uuid().safeParse(query.get("offerId"));
    if (!offer.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return listOfferAttachments(offer.data, await vaultContext());
  }, "vault.v1");
}

// Links one of the caller's documents to one of the caller's own saved offers. The link is private to the caller.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { documentId, offerId } = await readJson(request, z.strictObject({ documentId: z.uuid(), offerId: z.uuid() }));
    return attachOfferDocument(documentId, offerId, await vaultContext());
  }, "vault.v1");
}

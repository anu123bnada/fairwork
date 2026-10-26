import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { addOfferNote, listOfferNotes } from "@/server/vault/service";
import { offerNoteInput } from "@/features/offer/notes";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const offer = z.uuid().safeParse(query.get("offerId"));
    if (!offer.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return listOfferNotes(offer.data, await vaultContext());
  }, "offers.v1");
}

// A private review note on the caller's own saved offer.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    return addOfferNote(await readJson(request, offerNoteInput), await vaultContext());
  }, "offers.v1");
}

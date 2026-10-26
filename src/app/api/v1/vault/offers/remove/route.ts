import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { detachOfferDocument } from "@/server/vault/service";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { documentId, offerId } = await readJson(request, z.strictObject({ documentId: z.uuid(), offerId: z.uuid() }));
    return detachOfferDocument(documentId, offerId, await vaultContext());
  }, "vault.v1");
}

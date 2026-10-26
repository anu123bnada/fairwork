import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { deleteOfferNote } from "@/server/vault/service";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { noteId } = await readJson(request, z.strictObject({ noteId: z.uuid() }));
    return deleteOfferNote(noteId, await vaultContext());
  }, "offers.v1");
}

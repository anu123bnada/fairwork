import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { deleteDocument } from "@/server/vault/service";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { documentId } = await readJson(request, z.strictObject({ documentId: z.uuid() }));
    return deleteDocument(documentId, await vaultContext());
  }, "vault.v1");
}

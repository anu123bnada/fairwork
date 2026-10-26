import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { detachDocument } from "@/server/vault/service";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { documentId, workId } = await readJson(request, z.strictObject({ documentId: z.uuid(), workId: z.uuid() }));
    return detachDocument(documentId, workId, await vaultContext());
  }, "vault.v1");
}

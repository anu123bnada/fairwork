import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { attachDocument, listAttachments } from "@/server/vault/service";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const work = z.uuid().safeParse(query.get("workId"));
    if (!work.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return listAttachments(work.data, await vaultContext());
  }, "vault.v1");
}

// Links one of the caller's documents to one of the caller's own work records. The link is private to the caller.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { documentId, workId } = await readJson(request, z.strictObject({ documentId: z.uuid(), workId: z.uuid() }));
    return attachDocument(documentId, workId, await vaultContext());
  }, "vault.v1");
}

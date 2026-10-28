import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { reinstateDocument } from "@/server/vault/service";
import { reinstateInput } from "@/features/vault/evidence";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => { assertSameOrigin(request); const { documentId } = await readJson(request, reinstateInput); return reinstateDocument(documentId, await vaultContext()); }, "vault.v1");
}

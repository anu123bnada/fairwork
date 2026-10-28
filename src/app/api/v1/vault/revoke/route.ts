import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { revokeDocument } from "@/server/vault/service";
import { revokeInput } from "@/features/vault/evidence";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => { assertSameOrigin(request); return revokeDocument(await readJson(request, revokeInput), await vaultContext()); }, "vault.v1");
}

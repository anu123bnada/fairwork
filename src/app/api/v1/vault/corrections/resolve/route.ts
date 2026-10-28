import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { resolveCorrection } from "@/server/vault/service";
import { resolveInput } from "@/features/vault/evidence";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => { assertSameOrigin(request); const { correctionId } = await readJson(request, resolveInput); return resolveCorrection(correctionId, await vaultContext()); }, "vault.v1");
}

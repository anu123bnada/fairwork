import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { addCorrection } from "@/server/vault/service";
import { correctionInput } from "@/features/vault/evidence";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => { assertSameOrigin(request); return addCorrection(await readJson(request, correctionInput), await vaultContext()); }, "vault.v1");
}

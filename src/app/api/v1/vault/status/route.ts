import { apiResponse } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { evidenceStatus } from "@/server/vault/service";
export const dynamic = "force-dynamic";

// Revocation and correction notes for the caller's own documents.
export async function GET() {
  return apiResponse(async () => evidenceStatus(await vaultContext()), "vault.v1");
}

import { z } from "zod";
import { apiResponse } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { documentLink } from "@/server/vault/service";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

// Returns a short-lived signed download URL for the caller's own document; anyone else gets NOT_FOUND.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const parsed = z.uuid().safeParse(query.get("id"));
    if (!parsed.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return documentLink(parsed.data, await vaultContext());
  }, "vault.v1");
}

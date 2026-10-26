import { apiResponse, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { getServerEnvironment } from "@/server/env";
import { credentialConfig } from "@/server/credentials/config";
import { authenticateDeveloper } from "@/server/developer/auth";
import { verifyForIntegrator } from "@/server/developer/verify";
import { verifyRequest } from "@/features/developer/keys";
import { AppError } from "@/lib/errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

// Developer API v1: verify a credential. Server-to-server only: the key is a bearer secret and there is no cross-origin
// allowance. Authenticated by a developer key with the credentials:verify scope.
// Probes with bad keys are limited per caller address here, in addition to the per-key ceiling in the database.
const hits = new Map<string, number[]>();
function allowAttempt(caller: string, now: number) {
  const recent = (hits.get(caller) ?? []).filter(at => now - at < 60_000);
  if (recent.length >= 120) { hits.set(caller, recent); return false; }
  recent.push(now); hits.set(caller, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  return true;
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    if (!allowAttempt(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "unknown", Date.now())) throw new AppError("RATE_LIMITED", 429);
    const client = await createServerSupabase(false);
    const rpc = async (name: string, payload: Record<string, unknown>) => client.rpc(name as "developer_key_check", { request: payload as Json });
    await authenticateDeveloper(request, "credentials:verify", rpc);
    const input = await readJson(request, verifyRequest);
    return verifyForIntegrator(input.credential, { config: credentialConfig(getServerEnvironment().origin), rpc, now: new Date() });
  }, "developer.v1");
}

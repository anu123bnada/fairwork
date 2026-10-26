import { apiResponse } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { statusResponse } from "@/server/credentials/issue";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { z } from "zod";
export const dynamic = "force-dynamic";

// PUBLIC on purpose: anyone holding a credential's QR code can ask whether it is still valid. The answer
// is only valid, revoked, expired or unknown for an unguessable id, never a name, content or identity.
// The limiter is per server process and per caller address; it protects the database, not secrecy.
const query = z.strictObject({ id: z.uuid() });
const hits = new Map<string, number[]>();
const LIMIT = 60, WINDOW_MS = 60_000;
function allow(caller: string, now: number) {
  const recent = (hits.get(caller) ?? []).filter(at => now - at < WINDOW_MS);
  if (recent.length >= LIMIT) { hits.set(caller, recent); return false; }
  recent.push(now); hits.set(caller, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  return true;
}

export async function GET(request: Request) {
  return apiResponse(async () => {
    const params = new URL(request.url).searchParams;
    const input = query.safeParse(Object.fromEntries(params));
    if (!input.success || params.size !== 1) throw new AppError("VALIDATION_FAILED", 422);
    const caller = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "unknown";
    if (!allow(caller, Date.now())) throw new AppError("RATE_LIMITED", 429);
    const client = await createServerSupabase(true);
    const { data, error } = await client.rpc("credential_status", { request: { credentialId: input.data.id } });
    if (error) throw mapDatabaseError(error);
    const parsed = statusResponse.safeParse(data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return parsed.data;
  }, "credential-status.v1");
}

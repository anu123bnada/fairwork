import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { revokeRequest } from "@/server/credentials/issue";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { z } from "zod";
import { after } from "next/server";
import { notifyOwner } from "@/server/developer/webhook-service";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";

const receipt = z.strictObject({ credentialId: z.uuid(), status: z.literal("revoked") });

// Only the holder can revoke their own credential; the database refuses everyone else with NOT_FOUND.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, revokeRequest);
    const client = await createServerSupabase(true);
    const { data: identity, error: authError } = await client.auth.getUser();
    if (isAuthServiceUnavailable(authError)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    const { data, error } = await client.rpc("credential_revoke", { request: input });
    if (error) throw mapDatabaseError(error);
    const parsed = receipt.safeParse(data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    // Tell the holder's own registered endpoints, after the response has been sent. A failing endpoint never affects the revocation.
    const rpc = async (name: string, payload: Record<string, unknown>) => client.rpc(name as "webhook_targets", { request: payload as Json });
    try { after(async () => { await notifyOwner(rpc, "credential.revoked", { credentialId: parsed.data.credentialId, reason: "holder_requested" }); }); }
    catch { /* no request scope (for example in a unit test): the revocation itself already succeeded */ }
    return parsed.data;
  }, "credentials.v1");
}

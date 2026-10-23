import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { mfaInput } from "@/features/authority/schema";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import {recordRuntimeEvent} from "@/server/telemetry";

export const dynamic = "force-dynamic";
async function authenticated() {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  return client;
}
function providerError(error: { status?: number } | null) {
  if (!error) return;
  if (error.status === 429) throw new AppError("RATE_LIMITED", 429);
  if ((error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  throw new AppError("ACTION_FORBIDDEN", 403);
}
export async function GET(request: Request) {
  return apiResponse(async () => {
    if (new URL(request.url).search) throw new AppError("VALIDATION_FAILED", 422);
    const client = await authenticated();
    const result = await client.auth.mfa.listFactors(); providerError(result.error);
    return { factors: result.data!.totp.map(f => ({ id: f.id, status: f.status })) };
  }, "auth-mfa.v1");
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, mfaInput);
    const client = await authenticated();
    if (input.action === "enroll") {
      const factors = await client.auth.mfa.listFactors(); providerError(factors.error);
      // Do not silently replace an existing factor or enroll on every render.
      if (factors.data!.totp.some(f => f.status === "verified")) throw new AppError("ACTION_FORBIDDEN", 403);
      const result = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "ORYQEN operator" }); providerError(result.error);
      // This one-time enrollment secret is returned only to the authenticated
      // same-origin caller, never logged or persisted by the application.
      return { factorId: result.data!.id, secret: result.data!.totp.secret };
    }
    const challenge = await client.auth.mfa.challenge({ factorId: input.factorId }); providerError(challenge.error);
    const result = await client.auth.mfa.verify({ factorId: input.factorId, challengeId: challenge.data!.id, code: input.code }); providerError(result.error);
    const verified=await client.auth.getUser();
    if(!verified.error&&verified.data.user&&!verified.data.user.is_anonymous)await recordRuntimeEvent({id:crypto.randomUUID(),kind:"mfa_success",operation:"auth.mfa",subjectId:verified.data.user.id});
    // SSR client writes upgraded cookies. Never serialize the token response.
    return { verified: true };
  }, "auth-mfa.v1");
}

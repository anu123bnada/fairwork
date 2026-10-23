import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { signInSchema } from "@/features/identity/schema";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { accountAccess } from "@/features/identity/deactivation-schema";
import {recordRuntimeEvent} from "@/server/telemetry";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const credentials = await readJson(request, signInSchema);
    const supabase = await createServerSupabase(true);
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if(error)await recordRuntimeEvent({id:crypto.randomUUID(),kind:"login_failure",operation:"auth.sign-in",code:error.status===429?"RATE_LIMITED":"AUTH_REQUIRED"});
    if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error) throw new AppError(error.status === 429 ? "RATE_LIMITED" : "AUTH_REQUIRED", error.status === 429 ? 429 : 401);
    try {
      const access = await supabase.rpc("account_access", { request: {} });
      const parsed = accountAccess.safeParse(access.data);
      if (access.error || !parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
      if (parsed.data.access === "disabled") throw new AppError("ACTION_FORBIDDEN", 403);
    } catch (error) {
      // Password authentication has already installed a session. Transport
      // exceptions must take the same cleanup path as rejected RPC results.
      try {
        const cleanup = await supabase.auth.signOut({ scope: "local" });
        if (cleanup.error) throw new AppError("SERVICE_UNAVAILABLE", 503);
      } catch { throw new AppError("SERVICE_UNAVAILABLE", 503); }
      throw error instanceof AppError ? error : new AppError("SERVICE_UNAVAILABLE", 503);
    }
    if(data?.user?.id)await recordRuntimeEvent({id:crypto.randomUUID(),kind:"login_success",operation:"auth.sign-in",subjectId:data.user.id});
    return { signedIn: true };
  });
}

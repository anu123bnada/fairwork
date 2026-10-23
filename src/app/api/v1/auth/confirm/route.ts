import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { emailConfirmationSchema } from "@/features/identity/registration-schema";
import { requireRegistration } from "@/server/registration";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    requireRegistration();
    const { tokenHash } = await readJson(request, emailConfirmationSchema);
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error?.status === 429) throw new AppError("RATE_LIMITED", 429);
    if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user?.email_confirmed_at || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    return { confirmed: true };
  }, "auth-registration.v1");
}

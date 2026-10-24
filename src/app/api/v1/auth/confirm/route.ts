import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { confirmationCallbackSchema } from "@/features/identity/registration-schema";
import { requireRegistration } from "@/server/registration";
import { createStagedServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import type { User } from "@supabase/supabase-js";

function requireConfirmedUser(user: User | null, error: { status?: number } | null) {
  if (error?.status === 429) throw new AppError("RATE_LIMITED", 429);
  if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !user?.id || !user.email_confirmed_at || user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  return user;
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    requireRegistration();
    const input = await readJson(request, confirmationCallbackSchema);
    const { client, commitCookies } = await createStagedServerSupabase();
    let expectedUserId: string | undefined;
    if ("accessToken" in input) {
      // A fragment is untrusted. Validate the access token against this project's
      // Auth server, then validate/rotate the refresh token and bind both users.
      const checked = await client.auth.getUser(input.accessToken);
      expectedUserId = requireConfirmedUser(checked.data.user, checked.error).id;
    }
    const { data, error } = "tokenHash" in input
      ? await client.auth.verifyOtp({ token_hash: input.tokenHash, type: "email" })
      : await client.auth.refreshSession({ refresh_token: input.refreshToken });
    const user = requireConfirmedUser(data.user, error);
    if (!data.session || data.session.user?.id !== user.id || (expectedUserId && user.id !== expectedUserId)) throw new AppError("AUTH_REQUIRED", 401);
    commitCookies();
    return { confirmed: true };
  }, "auth-registration.v1");
}

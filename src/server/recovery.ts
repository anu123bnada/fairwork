import "server-only";
import {recordRuntimeEvent} from "./telemetry";
import { createClient } from "@supabase/supabase-js";
import { requirePublicEnvironment } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { getServerEnvironment } from "./env";
import { createServerSupabase, createStagedServerSupabase } from "./supabase";
import type { z } from "zod";
import type { recoveryTokenSchema } from "@/features/identity/recovery-schema";
import { authPath } from "@/features/identity/auth-navigation";

function providerFailure(error: { status?: number } | null, invalid = false) {
  if (!error) return;
  if (error.status === 429) throw new AppError("RATE_LIMITED", 429);
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  throw new AppError(invalid ? "AUTH_REQUIRED" : "VALIDATION_FAILED", invalid ? 401 : 422);
}
export async function requestRecovery(email: string, continuation = "") {
  const { origin } = getServerEnvironment();
  if (!process.env.APP_ORIGIN || (process.env.NODE_ENV === "production" && !origin.startsWith("https://"))) throw new AppError("SERVICE_UNAVAILABLE", 503);
  const { url, key } = requirePublicEnvironment();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}${authPath("/auth/recover", continuation)}` });
  // Never disclose whether an address exists. Supabase enforces email/IP limits.
  if (error?.status === 429) throw new AppError("RATE_LIMITED", 429);
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return { requested: true };
}
export async function confirmRecovery(input: z.infer<typeof recoveryTokenSchema>) {
  if ("tokenHash" in input) {
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.verifyOtp({ token_hash: input.tokenHash, type: "recovery" });
    providerFailure(error, true);
    if (!data.user?.email_confirmed_at || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    return { confirmed: true };
  }
  // The tokens a default Supabase recovery or invitation email puts in the link fragment. The browser's copy is untrusted: Supabase's Auth server must
  // accept the access token, then the refresh token is exchanged (and so rotated) and must belong to the same confirmed account. Cookies are only
  // committed after every check passes, so a bad link leaves no session behind.
  const { client, commitCookies } = await createStagedServerSupabase();
  const checked = await client.auth.getUser(input.accessToken);
  providerFailure(checked.error, true);
  const expected = checked.data.user;
  const issuedForThisLink = input.link === "invite" ? Boolean(expected?.invited_at) : Boolean(expected?.recovery_sent_at);
  if (!expected?.id || !expected.email_confirmed_at || expected.is_anonymous || !issuedForThisLink) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await client.auth.refreshSession({ refresh_token: input.refreshToken });
  providerFailure(error, true);
  if (!data.session || data.user?.id !== expected.id || data.session.user?.id !== expected.id) throw new AppError("AUTH_REQUIRED", 401);
  commitCookies();
  return { confirmed: true };
}
export async function updatePassword(password: string) {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  providerFailure(error, true);
  if (!data.user?.email_confirmed_at || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || !assurance.data) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") throw new AppError("MFA_REQUIRED", 403);
  const updated = await client.auth.updateUser({ password });
  providerFailure(updated.error);
  await recordRuntimeEvent({id:crypto.randomUUID(),kind:"password_changed",operation:"auth.password",subjectId:data.user.id});
  // Revoke refresh sessions, including this one, after a password change.
  // Already-issued access tokens expire according to the provider JWT lifetime.
  const signedOut = await client.auth.signOut({ scope: "global" });
  providerFailure(signedOut.error);
  return { updated: true, signInRequired: true };
}

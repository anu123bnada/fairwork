import "server-only";
import {recordRuntimeEvent} from "./telemetry";
import { createClient } from "@supabase/supabase-js";
import { requirePublicEnvironment } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getServerEnvironment } from "./env";
import { createServerSupabase } from "./supabase";
import { authPath } from "@/features/identity/auth-navigation";

function providerFailure(error: { status?: number } | null, invalid = false) {
  if (!error) return;
  if (error.status === 429) throw new AppError("RATE_LIMITED", 429);
  if ((error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
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
  if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return { requested: true };
}
export async function confirmRecovery(tokenHash: string) {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  providerFailure(error, true);
  if (!data.user?.email_confirmed_at || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
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

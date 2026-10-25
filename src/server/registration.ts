import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicEnvironment } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { getServerEnvironment } from "./env";
import { authPath } from "@/features/identity/auth-navigation";

export function requireRegistration() {
  if (process.env.AUTH_REGISTRATION_ENABLED !== "true") throw new AppError("ACTION_FORBIDDEN", 403);
  const config = getServerEnvironment();
  if (!process.env.APP_ORIGIN || (process.env.NODE_ENV === "production" && !config.origin.startsWith("https://"))) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return config;
}

export async function registerAccount(email: string, password: string, continuation = "", displayName?: string) {
  const { origin } = requireRegistration();
  const { url, key } = requirePublicEnvironment();
  // Check provider policy before creating an account. Do not accept auto-confirm
  // as a substitute for real email verification. Never return settings or tokens.
  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
  } catch { throw new AppError("SERVICE_UNAVAILABLE", 503); }
  if (!response.ok) throw new AppError("SERVICE_UNAVAILABLE", 503);
  const settings = await response.json().catch(() => null);
  if (!settings) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (settings.disable_signup !== false || settings.mailer_autoconfirm !== false ||
      settings.external?.email !== true || settings.external?.anonymous_users !== false) {
    throw new AppError("SERVICE_UNAVAILABLE", 503);
  }
  // Registration never installs a session, even if provider settings change
  // between the preflight and signup. No service key or authority metadata.
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.signUp({ email, password, options: {
    emailRedirectTo: `${origin}${authPath("/auth/confirm", continuation)}`,
    // Display-only metadata. Never used for identity, membership or permissions.
    ...(displayName ? { data: { display_name: displayName } } : {}),
  } });
  if (error?.status === 429) throw new AppError("RATE_LIMITED", 429);
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error && error.code !== "user_already_exists" && error.code !== "email_exists") throw new AppError("VALIDATION_FAILED", 422);
  if (data?.session) throw new AppError("SERVICE_UNAVAILABLE", 503);
  // Same response for an existing account and a new, unconfirmed account.
  return { verificationRequired: true };
}

export async function resendVerification(email: string, continuation = "") {
  const { origin } = requireRegistration();
  const { url, key } = requirePublicEnvironment();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}${authPath("/auth/confirm", continuation)}` } });
  if (error?.status === 429) throw new AppError("RATE_LIMITED", 429);
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  // The same response covers unknown, confirmed and unconfirmed addresses.
  return { verificationRequired: true };
}

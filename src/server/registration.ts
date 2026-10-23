import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicEnvironment } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getServerEnvironment } from "./env";

export function requireRegistration() {
  if (process.env.AUTH_REGISTRATION_ENABLED !== "true") throw new AppError("ACTION_FORBIDDEN", 403);
  const config = getServerEnvironment();
  if (!process.env.APP_ORIGIN || (process.env.NODE_ENV === "production" && !config.origin.startsWith("https://"))) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return config;
}

export async function registerAccount(email: string, password: string) {
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
  // between the preflight and signup. No service key, roles or user metadata.
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm` } });
  if (error?.status === 429) throw new AppError("RATE_LIMITED", 429);
  if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error && error.code !== "user_already_exists" && error.code !== "email_exists") throw new AppError("VALIDATION_FAILED", 422);
  if (data?.session) throw new AppError("SERVICE_UNAVAILABLE", 503);
  // Same response for an existing account and a new, unconfirmed account.
  return { verificationRequired: true };
}

import { confirmationSessionSchema } from "./registration-schema";
import { recoveryTokenHashSchema } from "./recovery-schema";

// What an email link opened on the recovery page carries. Inspection only: consuming a link needs an explicit same-origin POST (see RecoveryForm).
// Supabase sends one of three shapes, depending on the project's email template:
//   - token_hash in the fragment (the template documented in ORYQEN_HOSTED_AUTH_READINESS.md),
//   - access and refresh tokens in the fragment with type=recovery (the dashboard's default recovery template) or type=invite (an invitation),
//   - an error in the query or fragment (an expired or already-used link).
// A PKCE `code` cannot be completed here: the server started the reset, so there is no code verifier in this browser. It is reported, not guessed at.
export type RecoveryContext =
  | { kind: "ready"; tokenHash: string }
  | { kind: "session"; accessToken: string; refreshToken: string; link: "recovery" | "invite" }
  | { kind: "missing" | "invalid" | "expired" | "unsupported" };

export function recoveryContext(search: string, hash: string): RecoveryContext {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const both = [query, fragment];
  if (both.some(p => p.get("error_code") === "otp_expired")) return { kind: "expired" };
  if (both.some(p => p.has("error") || p.has("error_code") || p.has("error_description"))) return { kind: "invalid" };
  if (both.some(p => p.has("code"))) return { kind: "unsupported" };
  // Credentials in the query string would reach server logs and referrers, so only the fragment is accepted.
  if (query.has("access_token") || query.has("refresh_token") || query.has("token_hash")) return { kind: "invalid" };
  const hasSession = fragment.has("access_token") || fragment.has("refresh_token");
  const tokens = fragment.getAll("token_hash");
  if (hasSession) {
    const link = fragment.get("type");
    if (tokens.length || fragment.getAll("access_token").length !== 1 || fragment.getAll("refresh_token").length !== 1 || fragment.getAll("type").length !== 1
      || (link !== "recovery" && link !== "invite") || fragment.getAll("token_type").length !== 1 || fragment.get("token_type") !== "bearer") return { kind: "invalid" };
    const parsed = confirmationSessionSchema.safeParse({ accessToken: fragment.get("access_token"), refreshToken: fragment.get("refresh_token") });
    return parsed.success ? { kind: "session", ...parsed.data, link } : { kind: "invalid" };
  }
  if (!tokens.length) return { kind: "missing" };
  const hashType = fragment.getAll("type");
  if (tokens.length !== 1 || hashType.length > 1 || (hashType.length === 1 && hashType[0] !== "recovery")) return { kind: "invalid" };
  const parsed = recoveryTokenHashSchema.safeParse(tokens[0]);
  return parsed.success ? { kind: "ready", tokenHash: parsed.data } : { kind: "invalid" };
}

// Where a link that landed on the wrong page (for example the site root after an invitation) should go. The fragment is carried over unchanged by the
// caller; this only decides the destination, and only ever returns one of two fixed same-origin paths.
export function authLinkDestination(hash: string): "/auth/recover" | "/auth/confirm" | null {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const type = fragment.get("type");
  const carriesCredentials = fragment.has("access_token") || fragment.has("token_hash");
  if (carriesCredentials && (type === "recovery" || type === "invite")) return "/auth/recover";
  if (carriesCredentials && (type === "signup" || type === "email")) return "/auth/confirm";
  // A bare token_hash without a type is the documented confirmation template.
  if (fragment.has("token_hash") && !type) return "/auth/confirm";
  if (fragment.get("error_code") === "otp_expired" || (fragment.has("error") && fragment.has("error_code"))) return "/auth/recover";
  return null;
}

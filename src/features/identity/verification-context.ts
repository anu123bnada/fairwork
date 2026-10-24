import { confirmationSessionSchema, emailConfirmationSchema } from "./registration-schema";

export type VerificationContext = { kind: "ready"; tokenHash: string } | { kind: "session"; accessToken: string; refreshToken: string } | { kind: "missing" | "invalid" | "expired" };

// Inspect only; consuming a token requires an explicit same-origin POST.
export function verificationContext(search: string, hash: string): VerificationContext {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const params = [query, fragment];
  if (params.some(p => p.get("error_code") === "otp_expired")) return { kind: "expired" };
  if (params.some(p => ["error", "error_code", "code"].some(key => p.has(key)) || p.getAll("type").some(type => !["email", "signup"].includes(type)))) return { kind: "invalid" };
  if (params.some(p => p.has("access_token") || p.has("refresh_token"))) {
    // Default signup redirects carry credentials only in the browser fragment.
    // Reject duplicates, mixed protocols and recovery/OAuth callbacks.
    if (query.has("access_token") || query.has("refresh_token") || params.some(p => p.has("token_hash")) ||
        fragment.getAll("access_token").length !== 1 || fragment.getAll("refresh_token").length !== 1 ||
        fragment.getAll("type").length !== 1 || fragment.get("type") !== "signup" || query.has("type") ||
        fragment.getAll("token_type").length !== 1 || fragment.get("token_type") !== "bearer") return { kind: "invalid" };
    const result = confirmationSessionSchema.safeParse({ accessToken: fragment.get("access_token"), refreshToken: fragment.get("refresh_token") });
    return result.success ? { kind: "session", ...result.data } : { kind: "invalid" };
  }
  const tokens = params.flatMap(p => p.getAll("token_hash"));
  if (!tokens.length) return { kind: "missing" };
  const result = emailConfirmationSchema.safeParse({ tokenHash: tokens[0] });
  return tokens.length === 1 && result.success ? { kind: "ready", tokenHash: result.data.tokenHash } : { kind: "invalid" };
}

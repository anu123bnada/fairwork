import "server-only";
import type { JWK } from "jose";

// Signing configuration comes only from server-side secrets. The owner generates the key offline and
// supplies it to the hosting environment; the repository, the client bundle and the installers never
// contain it. When any part is missing or invalid, signing is simply unavailable (never a fallback key).
export type CredentialConfig = { issuer: string; keyId: string; privateJwk: JWK; publicKeys: Record<string, JWK>; statusUrl: string; verifyBase: string };

type Env = Record<string, string | undefined>;
const KEY_ID = /^[A-Za-z0-9._-]{1,64}$/;
const isEd25519 = (jwk: unknown): jwk is JWK => !!jwk && typeof jwk === "object" && (jwk as JWK).kty === "OKP" && (jwk as JWK).crv === "Ed25519" && typeof (jwk as JWK).x === "string";
function parse(value: string | undefined): unknown { if (!value) return undefined; try { return JSON.parse(value); } catch { return undefined; } }

export function credentialConfig(origin: string, env: Env = process.env): CredentialConfig | null {
  const keyId = env.ORYQEN_CREDENTIAL_KEY_ID?.trim();
  const privateJwk = parse(env.ORYQEN_CREDENTIAL_SIGNING_KEY);
  if (!keyId || !KEY_ID.test(keyId) || !isEd25519(privateJwk) || typeof privateJwk.d !== "string") return null;
  if (!/^https:\/\//.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return null; // never an insecure production issuer
  const configured = parse(env.ORYQEN_CREDENTIAL_PUBLIC_KEYS);
  const publicKeys: Record<string, JWK> = {};
  if (configured && typeof configured === "object" && !Array.isArray(configured)) {
    for (const [id, jwk] of Object.entries(configured)) if (KEY_ID.test(id) && isEd25519(jwk) && !("d" in jwk)) publicKeys[id] = { kty: "OKP", crv: "Ed25519", x: jwk.x, kid: id };
  }
  // The published set must contain the active key, and it must match the private key it claims to be.
  if (publicKeys[keyId]?.x !== privateJwk.x) {
    if (publicKeys[keyId]) return null;
    publicKeys[keyId] = { kty: "OKP", crv: "Ed25519", x: privateJwk.x, kid: keyId };
  }
  return { issuer: origin, keyId, privateJwk: { ...privateJwk, kid: keyId }, publicKeys, statusUrl: `${origin}/api/v1/credentials/status`, verifyBase: `${origin}/verify` };
}

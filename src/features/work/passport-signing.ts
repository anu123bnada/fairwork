import { CompactSign, compactVerify, importJWK, type JWK } from "jose";

// A signed copy of the holder's own verified Passport records (module 07). The signature is an Ed25519 JWS over the exact document, made with the same
// issuer key and published key set as credentials, so anyone can check it offline against /.well-known/oryqen-keys.json. What it proves: ORYQEN issued this
// exact document. What it does not: that the records are still eligible today (records can be withdrawn or corrected) or that the person is trustworthy.
export const SIGNED_PASSPORT_FORMAT = "oryqen-signed-passport.v1" as const;
export const SIGNED_PASSPORT_TYPE = "oryqen-passport+jws" as const;
const MAX_BYTES = 2_000_000;

export type PassportRecord = { role: string; companyName: string | null; periodStart: string; periodEnd: string; hours: string; summary: string; revision: number; verifiedAt: string };
export type SignedPassportPayload = { format: typeof SIGNED_PASSPORT_FORMAT; issuer: string; issuedAt: string; notice: string; moreRecordsAvailable: false; records: PassportRecord[] };

export function passportPayload(input: { issuer: string; issuedAt: Date; records: PassportRecord[] }): SignedPassportPayload {
  return {
    format: SIGNED_PASSPORT_FORMAT, issuer: input.issuer, issuedAt: input.issuedAt.toISOString(), moreRecordsAvailable: false,
    notice: "Signed copy of verified records as they stood at the issue time. It does not show whether a record has since been withdrawn or corrected, and it is not a statement that the holder is trustworthy.",
    records: input.records,
  };
}

export async function signPassport(payload: SignedPassportPayload, key: { privateJwk: JWK; keyId: string }): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.byteLength > MAX_BYTES) throw new Error("Passport is too large to sign.");
  return new CompactSign(bytes).setProtectedHeader({ alg: "EdDSA", typ: SIGNED_PASSPORT_TYPE, kid: key.keyId }).sign(await importJWK(key.privateJwk, "EdDSA"));
}

export type PassportVerification = { valid: true; payload: SignedPassportPayload; keyId: string } | { valid: false; reason: "malformed" | "unknown_key" | "bad_signature" | "wrong_issuer" | "wrong_type" | "not_a_passport" };

export async function verifySignedPassport(jws: string, input: { issuer: string; publicKeys: Record<string, JWK> }): Promise<PassportVerification> {
  if (typeof jws !== "string" || jws.length > MAX_BYTES * 2 || jws.split(".").length !== 3) return { valid: false, reason: "malformed" };
  let header: { kid?: unknown; alg?: unknown; typ?: unknown };
  try { header = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(jws.split(".")[0]!.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0)))); } catch { return { valid: false, reason: "malformed" }; }
  if (header.typ !== SIGNED_PASSPORT_TYPE || header.alg !== "EdDSA") return { valid: false, reason: "wrong_type" };
  const keyId = typeof header.kid === "string" ? header.kid : "";
  const jwk = Object.hasOwn(input.publicKeys, keyId) ? input.publicKeys[keyId] : undefined;
  if (!jwk) return { valid: false, reason: "unknown_key" };
  let body: Uint8Array;
  try { ({ payload: body } = await compactVerify(jws, await importJWK(jwk, "EdDSA"), { algorithms: ["EdDSA"] })); } catch { return { valid: false, reason: "bad_signature" }; }
  let payload: SignedPassportPayload;
  try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return { valid: false, reason: "malformed" }; }
  if (!payload || payload.format !== SIGNED_PASSPORT_FORMAT || !Array.isArray(payload.records)) return { valid: false, reason: "not_a_passport" };
  if (payload.issuer !== input.issuer) return { valid: false, reason: "wrong_issuer" };
  return { valid: true, payload, keyId };
}

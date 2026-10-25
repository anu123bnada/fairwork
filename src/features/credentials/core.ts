import { SignJWT, jwtVerify, importJWK, exportJWK, generateKeyPair, decodeProtectedHeader, type JWK } from "jose";
import { z } from "zod";
import type { TrustClaim } from "@/features/trust/schema";

// Verifiable credential core (module 18). Signing and verification use the `jose` library with Ed25519
// (EdDSA). No custom cryptography: this file only decides WHAT may be signed and HOW a result is judged.
//
// A credential is a compact JWS whose payload states that ORYQEN's records showed a claim with a stated
// assurance at a stated time. It never says an employer or a person is trustworthy, and it can never
// describe a self-reported claim as verified.

export const CREDENTIAL_TYPE = "oryqen.work-claim.v1";
export const MAX_CREDENTIAL_BYTES = 4096;
export const MAX_LIFETIME_DAYS = 365;

export const credentialPayload = z.strictObject({
  iss: z.url(),
  jti: z.uuid(),
  sub: z.uuid(), // random per credential: never the account id, so credentials are unlinkable by subject
  iat: z.number().int().positive(), nbf: z.number().int().positive(), exp: z.number().int().positive(),
  vct: z.literal(CREDENTIAL_TYPE),
  claim: z.strictObject({
    type: z.enum(["employment_period", "work_performed", "offer_terms"]),
    statement: z.string().trim().min(1).max(300),
    // Only these two ever appear. "self_reported" and "unreviewed" are not credential material.
    assurance: z.enum(["independently_reviewed", "counterparty_acknowledged"]),
    assuranceAt: z.string().nullable(),
    claimRef: z.string().regex(/^[0-9a-f]{64}$/),
    caveat: z.string().max(400).nullable(),
  }),
  status: z.strictObject({ type: z.literal("oryqen-status.v1"), url: z.url() }),
}).refine(p => p.exp > p.nbf && p.exp - p.iat <= MAX_LIFETIME_DAYS * 86400, { message: "invalid lifetime" })
  .refine(p => p.claim.assurance !== "independently_reviewed" || (p.claim.caveat !== null && /demo-authority/.test(p.claim.caveat)), { message: "reviewed credentials must carry the authority caveat" });
export type CredentialPayload = z.infer<typeof credentialPayload>;

export type Eligibility = { eligible: true } | { eligible: false; reason: string };
// Who may receive a credential: only claims that are currently valid AND backed by a second party.
export function credentialEligibility(claim: TrustClaim): Eligibility {
  if (claim.verification.assurance !== "independently_reviewed" && claim.verification.assurance !== "counterparty_acknowledged") return { eligible: false, reason: "Self-reported or unreviewed claims cannot be issued as credentials." };
  if (claim.validity.state !== "active") return { eligible: false, reason: `The claim is not currently valid (${claim.validity.state}).` };
  if (claim.type === "offer_terms") return { eligible: false, reason: "Offer terms are not issued as credentials." };
  return { eligible: true };
}

export type IssueInput = {
  claim: TrustClaim; statement?: string; issuer: string; statusUrl: string; now: Date; lifetimeDays: number;
  credentialId: string; subjectRef: string; kid: string;
};
// `statement` lets the holder disclose less than the full claim; it can only be shorter, never invented.
export async function issueCredential(input: IssueInput, privateJwk: JWK): Promise<{ jws: string; payload: CredentialPayload }> {
  const eligibility = credentialEligibility(input.claim);
  if (!eligibility.eligible) throw new CredentialError("not_eligible", eligibility.reason);
  const assurance = input.claim.verification.assurance as "independently_reviewed" | "counterparty_acknowledged";
  const statement = (input.statement ?? input.claim.statement).trim();
  if (statement !== input.claim.statement.trim() && !input.claim.statement.includes(statement)) throw new CredentialError("invalid_statement", "A disclosed statement must be a part of the verified claim, not new text.");
  if (!Number.isInteger(input.lifetimeDays) || input.lifetimeDays < 1 || input.lifetimeDays > MAX_LIFETIME_DAYS) throw new CredentialError("invalid_lifetime", "Lifetime must be 1 to 365 days.");
  const iat = Math.floor(input.now.getTime() / 1000);
  const payload = credentialPayload.parse({
    iss: input.issuer, jti: input.credentialId, sub: input.subjectRef, iat, nbf: iat, exp: iat + input.lifetimeDays * 86400, vct: CREDENTIAL_TYPE,
    claim: { type: input.claim.type, statement, assurance, assuranceAt: input.claim.verification.verifiedAt, claimRef: input.claim.claimId, caveat: input.claim.verification.caveat },
    status: { type: "oryqen-status.v1", url: input.statusUrl },
  });
  const key = await importJWK(privateJwk, "EdDSA");
  const jws = await new SignJWT(payload as unknown as Record<string, unknown>).setProtectedHeader({ alg: "EdDSA", typ: "oryqen+jwt", kid: input.kid }).sign(key);
  if (jws.length > MAX_CREDENTIAL_BYTES) throw new CredentialError("too_large", "Credential exceeds the size limit.");
  return { jws, payload };
}

export type VerifyOptions = { issuer: string; publicKeys: Record<string, JWK>; now: Date; revoked?: ReadonlySet<string> };
export type Verification =
  | { valid: true; payload: CredentialPayload; assurance: CredentialPayload["claim"]["assurance"] }
  | { valid: false; reason: "malformed" | "unsupported_algorithm" | "unknown_key" | "bad_signature" | "wrong_issuer" | "expired" | "not_yet_valid" | "revoked" | "invalid_payload" };

// Judges a credential offline from the published key set, then applies the revocation list. Every
// failure path returns a fixed reason code; nothing from the credential is echoed back.
export async function verifyCredential(jws: string, options: VerifyOptions): Promise<Verification> {
  if (typeof jws !== "string" || jws.length > MAX_CREDENTIAL_BYTES || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jws)) return { valid: false, reason: "malformed" };
  let header: ReturnType<typeof decodeProtectedHeader>;
  try { header = decodeProtectedHeader(jws); } catch { return { valid: false, reason: "malformed" }; }
  if (header.alg !== "EdDSA" || header.typ !== "oryqen+jwt") return { valid: false, reason: "unsupported_algorithm" };
  const jwk = typeof header.kid === "string" ? options.publicKeys[header.kid] : undefined;
  if (!jwk) return { valid: false, reason: "unknown_key" };
  let raw: unknown;
  try {
    const key = await importJWK(jwk, "EdDSA");
    // Time is checked below against the injected clock; algorithm and issuer are pinned here.
    ({ payload: raw } = await jwtVerify(jws, key, { algorithms: ["EdDSA"], issuer: options.issuer, currentDate: options.now }));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ERR_JWT_EXPIRED") return { valid: false, reason: "expired" };
    if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED") { const claim = (error as { claim?: string }).claim; return { valid: false, reason: claim === "iss" ? "wrong_issuer" : claim === "nbf" ? "not_yet_valid" : "invalid_payload" }; }
    return { valid: false, reason: code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ? "bad_signature" : "malformed" };
  }
  const parsed = credentialPayload.safeParse(raw);
  if (!parsed.success) return { valid: false, reason: "invalid_payload" };
  if (options.revoked?.has(parsed.data.jti)) return { valid: false, reason: "revoked" };
  return { valid: true, payload: parsed.data, assurance: parsed.data.claim.assurance };
}

export class CredentialError extends Error {
  constructor(readonly code: "not_eligible" | "invalid_statement" | "invalid_lifetime" | "too_large", message: string) { super(message); }
}

// Key helpers for tests and the one-time key ceremony. The private key is generated and held by the
// owner; the application only ever receives it through a server-side secret.
export async function generateSigningKey(kid: string): Promise<{ privateJwk: JWK; publicJwk: JWK }> {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { extractable: true });
  return { privateJwk: { ...(await exportJWK(privateKey)), kid }, publicJwk: { ...(await exportJWK(publicKey)), kid } };
}

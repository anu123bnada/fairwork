import { describe, expect, it } from "vitest";
import { CompactSign, exportJWK, generateKeyPair } from "jose";
import { passportPayload, signPassport, verifySignedPassport, SIGNED_PASSPORT_TYPE } from "@/features/work/passport-signing";
import { translate, type LocaleCode } from "@/i18n";

const ISSUER = "https://oryqen.example";
const record = { role: "Welder", companyName: "Synthetic Works", periodStart: "2026-01-01", periodEnd: "2026-03-31", hours: "480", summary: "Structural welding", revision: 2, verifiedAt: "2026-04-02T00:00:00Z" };
async function keys(id = "test-key") {
  const pair = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const privateJwk = { ...(await exportJWK(pair.privateKey)), kid: id }, publicJwk = { ...(await exportJWK(pair.publicKey)), kid: id };
  return { privateJwk, publicKeys: { [id]: publicJwk } };
}
const payload = () => passportPayload({ issuer: ISSUER, issuedAt: new Date("2026-10-27T10:00:00Z"), records: [record] });

describe("signed Work Passport copy", () => {
  it("round-trips: a document signed with the issuer key verifies offline and returns exactly what was signed", async () => {
    const { privateJwk, publicKeys } = await keys();
    const jws = await signPassport(payload(), { privateJwk, keyId: "test-key" });
    const result = await verifySignedPassport(jws, { issuer: ISSUER, publicKeys });
    expect(result).toMatchObject({ valid: true, keyId: "test-key" });
    if (result.valid) { expect(result.payload.records).toEqual([record]); expect(result.payload.notice).toMatch(/does not show whether a record has since been withdrawn/); }
  });
  it("rejects a tampered payload, a different key, the wrong issuer, an unknown key id and garbage", async () => {
    const { privateJwk, publicKeys } = await keys();
    const jws = await signPassport(payload(), { privateJwk, keyId: "test-key" });
    const [h, p, s] = jws.split(".");
    const forged = { ...payload(), records: [{ ...record, hours: "4800" }] };
    const forgedBody = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(await verifySignedPassport(`${h}.${forgedBody}.${s}`, { issuer: ISSUER, publicKeys })).toEqual({ valid: false, reason: "bad_signature" });
    expect(p).toBeTruthy();
    const other = await keys();
    expect(await verifySignedPassport(jws, { issuer: ISSUER, publicKeys: { "test-key": other.publicKeys["test-key"]! } })).toEqual({ valid: false, reason: "bad_signature" });
    expect(await verifySignedPassport(jws, { issuer: "https://other.example", publicKeys })).toEqual({ valid: false, reason: "wrong_issuer" });
    expect(await verifySignedPassport(jws, { issuer: ISSUER, publicKeys: {} })).toEqual({ valid: false, reason: "unknown_key" });
    expect(await verifySignedPassport("garbage", { issuer: ISSUER, publicKeys })).toEqual({ valid: false, reason: "malformed" });
    expect(await verifySignedPassport("a.b.c", { issuer: ISSUER, publicKeys })).toEqual({ valid: false, reason: "malformed" });
  });
  it("refuses a JWS of another type, such as a credential, and a signed document that is not a Passport", async () => {
    const { privateJwk, publicKeys } = await keys();
    const { importJWK } = await import("jose");
    const key = await importJWK(privateJwk, "EdDSA");
    const credentialLike = await new CompactSign(new TextEncoder().encode(JSON.stringify(payload()))).setProtectedHeader({ alg: "EdDSA", typ: "oryqen+jwt", kid: "test-key" }).sign(key);
    expect(await verifySignedPassport(credentialLike, { issuer: ISSUER, publicKeys })).toEqual({ valid: false, reason: "wrong_type" });
    const notPassport = await new CompactSign(new TextEncoder().encode(JSON.stringify({ hello: "world" }))).setProtectedHeader({ alg: "EdDSA", typ: SIGNED_PASSPORT_TYPE, kid: "test-key" }).sign(key);
    expect(await verifySignedPassport(notPassport, { issuer: ISSUER, publicKeys })).toEqual({ valid: false, reason: "not_a_passport" });
  });
  it("does not collide on prototype-like key ids and is described in every language", async () => {
    const { privateJwk, publicKeys } = await keys("__proto__x");
    const jws = await signPassport(payload(), { privateJwk, keyId: "__proto__x" });
    expect((await verifySignedPassport(jws, { issuer: ISSUER, publicKeys })).valid).toBe(true);
    const bad = await signPassport(payload(), { privateJwk, keyId: "constructor" });
    expect(await verifySignedPassport(bad, { issuer: ISSUER, publicKeys })).toEqual({ valid: false, reason: "unknown_key" });
    for (const key of ["pp.signedButton", "pp.signedNote", "pp.signedUnavailable"] as const) {
      const english = translate("en", key);
      for (const locale of ["si", "ta", "de"] as LocaleCode[]) expect(translate(locale, key)).not.toBe(english);
    }
  });
});

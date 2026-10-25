import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, importJWK, type JWK } from "jose";
import { CredentialError, credentialEligibility, generateSigningKey, issueCredential, verifyCredential, type IssueInput } from "@/features/credentials/core";
import type { TrustClaim } from "@/features/trust/schema";

const ISS = "https://oryqen.example.test/issuer", STATUS = "https://oryqen.example.test/api/v1/credentials/status";
const NOW = new Date("2026-10-26T12:00:00Z");
const hex = (c: string) => c.repeat(64);
const uuid = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DEMO = "The reviewer's organization authority was approved under the demo-authority.v1 policy. ORYQEN has not verified a real employer or legal identity.";
function claim(over: { assurance?: TrustClaim["verification"]["assurance"]; state?: TrustClaim["validity"]["state"]; type?: TrustClaim["type"] } = {}): TrustClaim {
  const assurance = over.assurance ?? "independently_reviewed";
  return {
    claimId: hex("a"), type: over.type ?? "work_performed", statement: "Welder: 40 hours, 2026-10-01 to 2026-10-05.",
    source: { kind: "work_record", id: uuid(1), version: 1, contentHash: hex("b"), recordedAt: "2026-10-01T10:00:00Z" }, providedBy: { role: "you", label: "You" },
    verification: { assurance, method: "m", verifiedAt: assurance === "independently_reviewed" ? "2026-10-02T09:00:00Z" : null, verifier: null, caveat: assurance === "independently_reviewed" ? DEMO : null },
    evidence: [], validity: { state: over.state ?? "active", expiresAt: null, endedAt: null, endedBy: null, reason: null, supersededByVersion: null },
    challenge: { possible: true, how: "h", href: null }, visibility: { summary: "s", shareable: true, manageHref: null }, audit: [],
  };
}
let keys: { privateJwk: JWK; publicJwk: JWK }, other: { privateJwk: JWK; publicJwk: JWK };
const input = (over: Partial<IssueInput> = {}): IssueInput => ({ claim: claim(), issuer: ISS, statusUrl: STATUS, now: NOW, lifetimeDays: 90, credentialId: uuid(50), subjectRef: uuid(60), kid: "k1", ...over });
const verifyOpts = (over = {}) => ({ issuer: ISS, publicKeys: { k1: keys.publicJwk }, now: new Date("2026-10-27T00:00:00Z"), ...over });
beforeAll(async () => { keys = await generateSigningKey("k1"); other = await generateSigningKey("k1"); });

describe("eligibility: only second-party-backed, currently valid claims", () => {
  it("rejects self-reported, unreviewed, ended and unsupported claims with a reason", () => {
    expect(credentialEligibility(claim())).toEqual({ eligible: true });
    expect(credentialEligibility(claim({ assurance: "counterparty_acknowledged", type: "employment_period" }))).toEqual({ eligible: true });
    for (const assurance of ["self_reported", "unreviewed"] as const) expect(credentialEligibility(claim({ assurance }))).toMatchObject({ eligible: false, reason: expect.stringContaining("cannot be issued") });
    for (const state of ["disputed", "rejected", "withdrawn", "retracted", "superseded", "draft", "pending"] as const) expect(credentialEligibility(claim({ state }))).toMatchObject({ eligible: false });
    expect(credentialEligibility(claim({ assurance: "counterparty_acknowledged", type: "offer_terms" }))).toMatchObject({ eligible: false });
  });
  it("refuses to sign an ineligible claim, an invented disclosure or a bad lifetime", async () => {
    await expect(issueCredential(input({ claim: claim({ assurance: "self_reported" }) }), keys.privateJwk)).rejects.toMatchObject({ code: "not_eligible" });
    await expect(issueCredential(input({ claim: claim({ state: "retracted" }) }), keys.privateJwk)).rejects.toBeInstanceOf(CredentialError);
    await expect(issueCredential(input({ statement: "Senior engineer with 10 years" }), keys.privateJwk)).rejects.toMatchObject({ code: "invalid_statement" });
    for (const lifetimeDays of [0, 366, 1.5, Number.NaN]) await expect(issueCredential(input({ lifetimeDays }), keys.privateJwk)).rejects.toMatchObject({ code: "invalid_lifetime" });
  });
});

describe("issue and verify", () => {
  it("round-trips a reviewed credential that carries the assurance, the caveat, and no account identity", async () => {
    const { jws, payload } = await issueCredential(input(), keys.privateJwk);
    expect(jws.split(".")).toHaveLength(3);
    const result = await verifyCredential(jws, verifyOpts());
    expect(result).toMatchObject({ valid: true, assurance: "independently_reviewed" });
    if (result.valid) {
      expect(result.payload.claim.caveat).toContain("demo-authority.v1"); expect(result.payload.claim.claimRef).toBe(hex("a"));
      expect(result.payload.sub).toBe(uuid(60)); expect(JSON.stringify(result.payload)).not.toContain(uuid(1)); // not the source record id either
      expect(result.payload.exp - result.payload.iat).toBe(90 * 86400); expect(payload.status.url).toBe(STATUS);
    }
  });
  it("stays small enough for a QR code (under 1,800 bytes, which fits a QR at medium error correction)", async () => {
    const { jws } = await issueCredential(input(), keys.privateJwk);
    console.log("sample credential bytes:", jws.length);
    expect(jws.length).toBeLessThan(1800);
  });
  it("lets the holder disclose less, as a part of the verified statement", async () => {
    const { payload } = await issueCredential(input({ statement: "Welder: 40 hours" }), keys.privateJwk);
    expect(payload.claim.statement).toBe("Welder: 40 hours");
  });
  it("issues counterparty-acknowledged credentials without an authority caveat requirement, but never as reviewed", async () => {
    const { jws } = await issueCredential(input({ claim: claim({ assurance: "counterparty_acknowledged", type: "employment_period" }) }), keys.privateJwk);
    expect(await verifyCredential(jws, verifyOpts())).toMatchObject({ valid: true, assurance: "counterparty_acknowledged" });
  });
});

describe("verification rejects", () => {
  let jws: string;
  beforeAll(async () => { jws = (await issueCredential(input(), keys.privateJwk)).jws; });
  const reason = async (token: string, over = {}) => { const r = await verifyCredential(token, verifyOpts(over)); return r.valid ? "VALID" : r.reason; };
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  it("tampered payloads, swapped signatures and the wrong key", async () => {
    const [h, p, s] = jws.split(".");
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString()); payload.claim.statement = "Director for 20 years";
    expect(await reason(`${h}.${b64(payload)}.${s}`)).toBe("bad_signature");
    expect(await reason(`${h}.${p}.${s!.slice(0, -4)}AAAA`)).toBe("bad_signature");
    const forged = (await issueCredential(input(), other.privateJwk)).jws; // same kid, different private key
    expect(await reason(forged)).toBe("bad_signature");
  });
  it("algorithm confusion: none, HS256 keyed with the public key, unknown kid and wrong type", async () => {
    const [, p] = jws.split(".");
    expect(await reason(`${b64({ alg: "none", typ: "oryqen+jwt", kid: "k1" })}.${p}.`)).toBe("malformed");
    expect(await reason(`${b64({ alg: "none", typ: "oryqen+jwt", kid: "k1" })}.${p}.AAAA`)).toBe("unsupported_algorithm");
    const hs = await new SignJWT({ x: 1 }).setProtectedHeader({ alg: "HS256", typ: "oryqen+jwt", kid: "k1" }).sign(new TextEncoder().encode(JSON.stringify(keys.publicJwk)));
    expect(await reason(hs)).toBe("unsupported_algorithm");
    expect(await reason(jws, { publicKeys: { other: keys.publicJwk } })).toBe("unknown_key");
    const wrongTyp = await new SignJWT({}).setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: "k1" }).sign(await importJWK(keys.privateJwk, "EdDSA"));
    expect(await reason(wrongTyp)).toBe("unsupported_algorithm");
  });
  it("wrong issuer, expiry, not-yet-valid and revocation", async () => {
    expect(await reason(jws, { issuer: "https://evil.example.test/issuer" })).toBe("wrong_issuer");
    expect(await reason(jws, { now: new Date("2027-02-01T00:00:00Z") })).toBe("expired");
    expect(await reason(jws, { now: new Date("2026-10-26T11:00:00Z") })).toBe("not_yet_valid");
    expect(await reason(jws, { revoked: new Set([uuid(50)]) })).toBe("revoked");
    expect(await reason(jws, { revoked: new Set([uuid(51)]) })).toBe("VALID");
  });
  it("malformed or oversized input without echoing anything", async () => {
    for (const bad of ["", "a.b", "a.b.c.d", "not a jwt", "a.b.c!", `${"a".repeat(5000)}.b.c`, null as unknown as string, 5 as unknown as string]) expect(await reason(bad)).toBe("malformed");
    const failure = await verifyCredential("abc.def.ghi", verifyOpts());
    expect(Object.keys(failure).sort()).toEqual(["reason", "valid"]);
  });
  it("correctly signed but unacceptable payloads: self-reported assurance, missing caveat, long lifetime, extra fields", async () => {
    const key = await importJWK(keys.privateJwk, "EdDSA");
    const iat = Math.floor(NOW.getTime() / 1000);
    const good = { iss: ISS, jti: uuid(70), sub: uuid(71), iat, nbf: iat, exp: iat + 86400, vct: "oryqen.work-claim.v1", claim: { type: "work_performed", statement: "x", assurance: "independently_reviewed", assuranceAt: null, claimRef: hex("a"), caveat: DEMO }, status: { type: "oryqen-status.v1", url: STATUS } };
    const sign = (p: unknown) => new SignJWT(p as Record<string, unknown>).setProtectedHeader({ alg: "EdDSA", typ: "oryqen+jwt", kid: "k1" }).sign(key);
    expect(await reason(await sign(good))).toBe("VALID");
    expect(await reason(await sign({ ...good, claim: { ...good.claim, assurance: "self_reported" } }))).toBe("invalid_payload");
    expect(await reason(await sign({ ...good, claim: { ...good.claim, caveat: null } }))).toBe("invalid_payload");
    expect(await reason(await sign({ ...good, claim: { ...good.claim, caveat: "Reviewed." } }))).toBe("invalid_payload");
    expect(await reason(await sign({ ...good, exp: iat + 400 * 86400 }))).toBe("invalid_payload");
    expect(await reason(await sign({ ...good, extra: "field" }))).toBe("invalid_payload");
  });
});

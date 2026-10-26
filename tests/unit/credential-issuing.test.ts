import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { JWK } from "jose";
import { credentialConfig } from "@/server/credentials/config";
import { issueForWorkRecord, issueRequest, type IssueDeps } from "@/server/credentials/issue";
import { generateSigningKey, verifyCredential } from "@/features/credentials/core";
import { workRecordClaims } from "@/features/trust/build";
import type { WorkRecord, WorkVersion } from "@/features/work/schema";

const ORIGIN = "https://oryqen.example.test";
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hex = (c: string) => c.repeat(64);
let keys: { privateJwk: JWK; publicJwk: JWK }, other: { privateJwk: JWK; publicJwk: JWK };
beforeAll(async () => { keys = await generateSigningKey("k1"); other = await generateSigningKey("k2"); });
const envFor = (over: Record<string, string | undefined> = {}) => ({ ORYQEN_CREDENTIAL_KEY_ID: "k1", ORYQEN_CREDENTIAL_SIGNING_KEY: JSON.stringify(keys.privateJwk), ...over });

describe("signing configuration", () => {
  it("is available only when a valid Ed25519 key, key id and secure origin are all present", () => {
    const config = credentialConfig(ORIGIN, envFor())!;
    expect(config).toMatchObject({ issuer: ORIGIN, keyId: "k1", statusUrl: `${ORIGIN}/api/v1/credentials/status`, verifyBase: `${ORIGIN}/verify` });
    expect(Object.keys(config.publicKeys)).toEqual(["k1"]); expect("d" in config.publicKeys.k1!).toBe(false);
    for (const bad of [{ ORYQEN_CREDENTIAL_SIGNING_KEY: undefined }, { ORYQEN_CREDENTIAL_KEY_ID: undefined }, { ORYQEN_CREDENTIAL_KEY_ID: "bad id!" }, { ORYQEN_CREDENTIAL_SIGNING_KEY: "not json" },
      { ORYQEN_CREDENTIAL_SIGNING_KEY: JSON.stringify(keys.publicJwk) }, { ORYQEN_CREDENTIAL_SIGNING_KEY: JSON.stringify({ ...keys.privateJwk, crv: "P-256" }) }])
      expect(credentialConfig(ORIGIN, envFor(bad))).toBeNull();
    expect(credentialConfig("http://oryqen.example.test", envFor())).toBeNull(); // no insecure production issuer
    expect(credentialConfig("http://localhost:3000", envFor())).not.toBeNull();
  });
  it("publishes only public material and rejects a published key that does not match the signing key", () => {
    const withOld = credentialConfig(ORIGIN, envFor({ ORYQEN_CREDENTIAL_PUBLIC_KEYS: JSON.stringify({ k2: other.publicJwk }) }))!;
    expect(Object.keys(withOld.publicKeys).sort()).toEqual(["k1", "k2"]); expect(JSON.stringify(withOld.publicKeys)).not.toContain('"d"');
    // A published entry that carries private material is dropped entirely, never echoed.
    const leaky = credentialConfig(ORIGIN, envFor({ ORYQEN_CREDENTIAL_PUBLIC_KEYS: JSON.stringify({ k2: { ...other.publicJwk, d: "must-not-leak" } }) }))!;
    expect(Object.keys(leaky.publicKeys)).toEqual(["k1"]); expect(JSON.stringify(leaky)).not.toContain("must-not-leak");
    expect(credentialConfig(ORIGIN, envFor({ ORYQEN_CREDENTIAL_PUBLIC_KEYS: JSON.stringify({ k1: other.publicJwk }) }))).toBeNull();
  });
});

function version(state: WorkVersion["state"], decided = state === "verified"): WorkVersion {
  return {
    version: 1, state, contentHash: hex("1"), evidenceHash: hex("e"), createdAt: "2026-10-01T10:00:00+00:00", submittedAt: "2026-10-01T11:00:00+00:00",
    content: { role: "Welder", periodStart: "2026-10-01", periodEnd: "2026-10-05", hours: "40", tasks: "Welded frames", evidence: [], schemaVersion: "work-record.v1", agreement: { id: id(5), version: 1, contentHash: hex("a"), authorityDecisionId: id(6), effectiveAt: "2026-10-01T00:00:00+00:00", scope: "Engineering" } },
    decision: decided ? { id: id(70), outcome: "verified", reason: "Matches the log", actorId: id(2), authorityDecisionId: id(80), contentHash: hex("1"), evidenceHash: hex("e"), recordedAt: "2026-10-02T09:00:00+00:00" } : null,
  } as WorkVersion;
}
const record = (state: WorkVersion["state"], workerId = id(1)): WorkRecord => ({ workId: id(10), agreementId: id(5), workerId, companyId: id(3), representativeId: id(2), currentVersion: 1, versions: [version(state)], integrityEvents: [] } as WorkRecord);
const rpc = vi.fn();
const deps = (over: Partial<IssueDeps> = {}): IssueDeps => ({
  rpc, readWork: async () => record("verified"), userId: id(1), config: credentialConfig(ORIGIN, envFor()), now: new Date("2026-10-26T12:00:00Z"),
  uuid: (() => { let n = 100; return () => id(++n); })(), ...over,
});
const request = (over = {}) => issueRequest.parse({ workId: id(10), idempotencyKey: id(900), ...over });
beforeEach(() => { rpc.mockReset(); rpc.mockImplementation(async (_name: string, payload: Record<string, unknown>) => ({ data: { credentialId: payload.credentialId, token: payload.token, expiresAt: payload.expiresAt, replayed: false }, error: null })); });

describe("issuing", () => {
  it("signs the caller's verified record, registers it bound to the content hash, and returns a credential that verifies", async () => {
    const result = await issueForWorkRecord(request({ lifetimeDays: 30 }), deps());
    const claim = workRecordClaims([record("verified")])[0]!;
    expect(rpc).toHaveBeenCalledWith("credential_register", expect.objectContaining({ sourceId: id(10), sourceVersion: 1, claimRef: claim.claimId, assurance: "independently_reviewed", keyId: "k1", idempotencyKey: id(900) }));
    expect(result.verifyUrl).toBe(`${ORIGIN}/verify#c=${result.token}`);
    const config = credentialConfig(ORIGIN, envFor())!;
    const verified = await verifyCredential(result.token, { issuer: ORIGIN, publicKeys: config.publicKeys, now: new Date("2026-10-27T00:00:00Z") });
    expect(verified).toMatchObject({ valid: true, assurance: "independently_reviewed" });
    if (verified.valid) { expect(verified.payload.claim.caveat).toContain("demo-authority.v1"); expect(verified.payload.claim.claimRef).toBe(claim.claimId); expect(JSON.stringify(verified.payload)).not.toContain(id(1)); }
  });
  it("lets the holder disclose less, and refuses invented text", async () => {
    const shorter = await issueForWorkRecord(request({ statement: "Welder: 40 hours" }), deps());
    const config = credentialConfig(ORIGIN, envFor())!;
    const ok = await verifyCredential(shorter.token, { issuer: ORIGIN, publicKeys: config.publicKeys, now: new Date("2026-10-27T00:00:00Z") });
    expect(ok.valid && ok.payload.claim.statement).toBe("Welder: 40 hours");
    await expect(issueForWorkRecord(request({ statement: "Senior director" }), deps())).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 422 });
  });
  it("refuses other people's records, unverified records, and an unconfigured server, without calling the database", async () => {
    await expect(issueForWorkRecord(request(), deps({ readWork: async () => record("verified", id(9)) }))).rejects.toMatchObject({ code: "ACTION_FORBIDDEN" }); // a reviewer, not the worker
    for (const state of ["draft", "submitted", "disputed", "rejected", "withdrawn", "invalidated"] as const)
      await expect(issueForWorkRecord(request(), deps({ readWork: async () => record(state) }))).rejects.toMatchObject({ code: "ACTION_FORBIDDEN" });
    await expect(issueForWorkRecord(request(), deps({ config: null }))).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("maps database refusals to safe errors and returns the original token on replay", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "VERSION_CONFLICT", code: "P0001" } });
    await expect(issueForWorkRecord(request(), deps())).rejects.toMatchObject({ code: "VERSION_CONFLICT", status: 409 });
    rpc.mockResolvedValueOnce({ data: { credentialId: id(555), token: "a".repeat(120) + ".b.c", expiresAt: "2027-01-01T00:00:00Z", replayed: true }, error: null });
    expect(await issueForWorkRecord(request(), deps())).toMatchObject({ credentialId: id(555), replayed: true, verifyUrl: `${ORIGIN}/verify#c=${"a".repeat(120)}.b.c` });
    rpc.mockResolvedValueOnce({ data: { unexpected: true }, error: null });
    await expect(issueForWorkRecord(request(), deps())).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
  it("validates the request strictly", () => {
    for (const bad of [{}, { workId: "x", idempotencyKey: id(1) }, { workId: id(1), idempotencyKey: id(1), lifetimeDays: 0 }, { workId: id(1), idempotencyKey: id(1), lifetimeDays: 366 }, { workId: id(1), idempotencyKey: id(1), holderId: id(2) }, { workId: id(1), idempotencyKey: id(1), statement: "" }])
      expect(issueRequest.safeParse(bad).success).toBe(false);
    expect(issueRequest.parse({ workId: id(1), idempotencyKey: id(2) }).lifetimeDays).toBe(90);
  });
});

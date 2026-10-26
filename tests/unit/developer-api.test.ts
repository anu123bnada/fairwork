import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { createHash } from "node:crypto";
import { POST as verifyPost } from "@/app/api/v1/developer/credentials/verify/route";
import { GET as keysGet, POST as keysPost } from "@/app/api/v1/developer/keys/route";
import { POST as revokePost } from "@/app/api/v1/developer/keys/revoke/route";
import { generateDeveloperKey, parseDeveloperKey } from "@/features/developer/keys";
import { generateSigningKey, issueCredential } from "@/features/credentials/core";
import { workRecordClaims } from "@/features/trust/build";
import type { WorkRecord } from "@/features/work/schema";

const ORIGIN = "http://localhost:3000";
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let keys: Awaited<ReturnType<typeof generateSigningKey>>;
beforeAll(async () => { keys = await generateSigningKey("k1"); });
beforeEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs(); vi.stubEnv("APP_ORIGIN", ORIGIN);
  vi.stubEnv("ORYQEN_CREDENTIAL_KEY_ID", "k1"); vi.stubEnv("ORYQEN_CREDENTIAL_SIGNING_KEY", JSON.stringify(keys.privateJwk));
  mocks.getUser.mockResolvedValue({ data: { user: { id: id(1) } }, error: null });
});
const call = (key: string | null, body: unknown, ip = "203.0.113.5") => verifyPost(new Request(`${ORIGIN}/api/v1/developer/credentials/verify`, {
  method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) }));
const hex = (c: string) => c.repeat(64);
const verifiedRecord = {
  workId: id(10), agreementId: id(5), workerId: id(1), companyId: id(3), representativeId: id(2), currentVersion: 1, integrityEvents: [],
  versions: [{
    version: 1, state: "verified", contentHash: hex("1"), evidenceHash: hex("e"), createdAt: "2026-10-01T10:00:00+00:00", submittedAt: "2026-10-01T11:00:00+00:00",
    content: { role: "Welder", periodStart: "2026-10-01", periodEnd: "2026-10-05", hours: "40", tasks: "Welded frames", evidence: [], schemaVersion: "work-record.v1", agreement: { id: id(5), version: 1, contentHash: hex("a"), authorityDecisionId: id(6), effectiveAt: "2026-10-01T00:00:00+00:00", scope: "Engineering" } },
    decision: { id: id(70), outcome: "verified", reason: "Matches the log", actorId: id(2), authorityDecisionId: id(80), contentHash: hex("1"), evidenceHash: hex("e"), recordedAt: "2026-10-02T09:00:00+00:00" },
  }],
} as unknown as WorkRecord;
const mint = async () => {
  const claim = workRecordClaims([verifiedRecord])[0]!;
  return (await issueCredential({ claim, issuer: ORIGIN, statusUrl: `${ORIGIN}/api/v1/credentials/status`, now: new Date(), lifetimeDays: 30, credentialId: id(50), subjectRef: id(51), kid: "k1" }, keys.privateJwk)).jws;
};

describe("developer key format", () => {
  it("generates a key whose hash is all the database ever sees, and parses only a well-formed bearer value", () => {
    const { keyId, key, secretHash } = generateDeveloperKey();
    expect(key).toMatch(/^oryq_live_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(parseDeveloperKey(`Bearer ${key}`)).toEqual({ keyId, secretHash });
    expect(secretHash).toBe(createHash("sha256").update(key.split(".")[1]!).digest("hex"));
    expect(secretHash).not.toContain(key.split(".")[1]!);
    for (const bad of [null, "", key, `bearer ${key}`, `Bearer ${key} extra`, `Bearer ${key.slice(0, -1)}`, `Bearer oryq_test_${key.slice(10)}`, "Basic abc", `Bearer ${key.replace(keyId, "not-a-uuid")}`]) expect(parseDeveloperKey(bad), String(bad)).toBeNull();
    expect(generateDeveloperKey().key).not.toBe(key);
  });
});

describe("developer verification endpoint", () => {
  const ok = (valid = true) => mocks.rpc.mockImplementation(async (name: string) => name === "developer_key_check"
    ? { data: { valid, scopes: ["credentials:verify"] }, error: null }
    : { data: { status: "valid", reason: null, checkedAt: "2026-10-27T00:00:00Z" }, error: null });

  it("answers every authentication failure identically with 401 and never reaches verification", async () => {
    const { key } = generateDeveloperKey(), token = await mint();
    expect((await call(null, { credential: token })).status).toBe(401);
    expect((await call("not-a-key", { credential: token })).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    ok(false); const refused = await call(key, { credential: token });
    expect(refused.status).toBe(401); expect(JSON.stringify(await refused.json())).not.toMatch(/revoked|unknown|scope|key/i);
    mocks.rpc.mockImplementation(async () => ({ data: { valid: true, scopes: [] }, error: null }));
    expect((await call(key, { credential: token })).status).toBe(401); // a valid key without the scope
  });

  it("verifies a genuine credential and returns only what the credential disclosed", async () => {
    const { key } = generateDeveloperKey(), token = await mint(); ok();
    const response = await call(key, { credential: token }); expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data).toMatchObject({ valid: true, state: "valid", credential: { id: id(50), assurance: "independently_reviewed", issuer: ORIGIN } });
    expect(data.credential.caveat).toMatch(/demo-authority/);
    expect(JSON.stringify(data)).not.toMatch(new RegExp(`${id(1)}|${id(10)}|${id(2)}`)); // no account, record or reviewer ids
    expect(mocks.rpc).toHaveBeenCalledWith("credential_status", { request: { credentialId: id(50) } });
  });

  it("reports revoked, tampered and malformed credentials as not valid, with the live reason", async () => {
    const { key } = generateDeveloperKey(), token = await mint();
    mocks.rpc.mockImplementation(async (name: string) => name === "developer_key_check" ? { data: { valid: true, scopes: ["credentials:verify"] }, error: null } : { data: { status: "revoked", reason: "holder_requested", checkedAt: "2026-10-27T00:00:00Z" }, error: null });
    expect((await (await call(key, { credential: token })).json()).data).toMatchObject({ valid: false, state: "revoked", reason: "holder_requested" });
    const [h, p, s] = token.split(".");
    const tampered = await (await call(key, { credential: `${h}.${p!.slice(0, -2)}AA.${s}` })).json();
    expect(tampered.data).toMatchObject({ valid: false, state: "not_verified" });
    expect((await (await call(key, { credential: "x".repeat(120) })).json()).data).toMatchObject({ valid: false, reason: "malformed" });
    expect((await call(key, { credential: token, extra: 1 })).status).toBe(422);
    expect((await call(key, { credential: "short" })).status).toBe(422);
  });

  it("surfaces the database rate limit as 429 and refuses without a configured issuer", async () => {
    const { key } = generateDeveloperKey(), token = await mint();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "RATE_LIMITED", code: "P0001" } });
    expect((await call(key, { credential: token })).status).toBe(429);
    ok(); vi.stubEnv("ORYQEN_CREDENTIAL_SIGNING_KEY", "");
    expect((await call(key, { credential: token })).status).toBe(503);
  });

  it("limits probing per caller address even when every key is wrong", async () => {
    mocks.rpc.mockResolvedValue({ data: { valid: false, scopes: [] }, error: null });
    const { key } = generateDeveloperKey();
    for (let i = 0; i < 120; i += 1) expect((await call(key, { credential: "x".repeat(120) }, "198.51.100.77")).status).toBe(401);
    expect((await call(key, { credential: "x".repeat(120) }, "198.51.100.77")).status).toBe(429);
  });
});

describe("developer key management routes", () => {
  const post = (path: string, body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/v1/developer/keys${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

  it("creates a key, sends only the hash to the database, and shows the full key once", async () => {
    mocks.rpc.mockImplementation(async (_name: string, args: { request: { keyId: string } }) => ({ data: { keyId: args.request.keyId, scopes: ["credentials:verify"] }, error: null }));
    const response = await keysPost(post("", { label: "HR system" })); expect(response.status).toBe(200);
    const data = (await response.json()).data;
    const sent = mocks.rpc.mock.calls[0]![1].request;
    expect(Object.keys(sent).sort()).toEqual(["keyId", "label", "secretHash"]);
    expect(data.key).toContain(sent.keyId); expect(JSON.stringify(sent)).not.toContain(data.key.split(".")[1]);
    expect(parseDeveloperKey(`Bearer ${data.key}`)?.secretHash).toBe(sent.secretHash);
  });

  it("requires sign-in and same origin, rejects extra fields, and lists without any secret", async () => {
    expect((await keysPost(post("", { label: "x" }, "https://evil.example.test"))).status).toBe(403);
    expect((await keysPost(post("", { label: "x", scopes: ["admin"] }))).status).toBe(422);
    expect((await keysPost(post("", { label: "" }))).status).toBe(422);
    expect((await revokePost(post("/revoke", { keyId: id(3), extra: 1 }))).status).toBe(422);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await keysPost(post("", { label: "x" }))).status).toBe(401); expect((await keysGet(new Request(`${ORIGIN}/api/v1/developer/keys`))).status).toBe(401);
    expect((await revokePost(post("/revoke", { keyId: id(3) }))).status).toBe(401);
    mocks.getUser.mockResolvedValue({ data: { user: { id: id(1) } }, error: null });
    mocks.rpc.mockResolvedValue({ data: { items: [{ keyId: id(3), label: "HR system", scopes: ["credentials:verify"], createdAt: "2026-10-27T00:00:00Z", revokedAt: null, callsLast24h: 4 }] }, error: null });
    const listed = await (await keysGet(new Request(`${ORIGIN}/api/v1/developer/keys`))).json();
    expect(listed.data.items[0]).toMatchObject({ callsLast24h: 4 }); expect(JSON.stringify(listed)).not.toMatch(/secret|oryq_live/);
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "NOT_FOUND", code: "P0001" } });
    expect((await revokePost(post("/revoke", { keyId: id(3) }))).status).toBe(404);
  });
});

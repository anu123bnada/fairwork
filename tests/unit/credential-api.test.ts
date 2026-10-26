import { beforeAll, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), work: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/server/work", () => ({ workService: mocks.work }));
import { GET as listGet, POST as issuePost } from "@/app/api/v1/credentials/route";
import { POST as revokePost } from "@/app/api/v1/credentials/revoke/route";
import { GET as statusGet } from "@/app/api/v1/credentials/status/route";
import { GET as keysGet } from "@/app/.well-known/oryqen-keys.json/route";
import { generateSigningKey } from "@/features/credentials/core";

const ORIGIN = "http://localhost:3000", base = `${ORIGIN}/api/v1/credentials`;
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let keys: Awaited<ReturnType<typeof generateSigningKey>>;
beforeAll(async () => { keys = await generateSigningKey("k1"); });
const post = (path: string, body: unknown, origin = ORIGIN) => new Request(`${base}${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs(); vi.stubEnv("APP_ORIGIN", ORIGIN);
  mocks.getUser.mockResolvedValue({ data: { user: { id: id(1) } }, error: null });
});
const sign = () => { vi.stubEnv("ORYQEN_CREDENTIAL_KEY_ID", "k1"); vi.stubEnv("ORYQEN_CREDENTIAL_SIGNING_KEY", JSON.stringify(keys.privateJwk)); };

it("the public status endpoint needs no sign-in, validates strictly and returns only a status", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.rpc.mockResolvedValue({ data: { status: "valid", reason: null, checkedAt: "2026-10-26T00:00:00Z" }, error: null });
  const response = await statusGet(new Request(`${base}/status?id=${id(5)}`, { headers: { "x-forwarded-for": "203.0.113.7" } }));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await response.json()).data).toEqual({ status: "valid", reason: null, checkedAt: "2026-10-26T00:00:00Z" });
  expect(mocks.rpc).toHaveBeenCalledWith("credential_status", { request: { credentialId: id(5) } }); expect(mocks.getUser).not.toHaveBeenCalled();
  for (const query of ["", "?id=nope", `?id=${id(5)}&extra=1`, `?id=${id(5)}&id=${id(6)}`]) expect((await statusGet(new Request(`${base}/status${query}`))).status).toBe(422);
});
it("the status endpoint rate-limits each caller and treats a malformed reply as unavailable", async () => {
  mocks.rpc.mockResolvedValue({ data: { status: "valid", reason: null, checkedAt: "x" }, error: null });
  const call = (ip: string) => statusGet(new Request(`${base}/status?id=${id(7)}`, { headers: { "x-forwarded-for": ip } }));
  for (let i = 0; i < 60; i++) expect((await call("198.51.100.9")).status).toBe(200);
  expect((await call("198.51.100.9")).status).toBe(429); expect((await call("198.51.100.10")).status).toBe(200);
  mocks.rpc.mockResolvedValue({ data: { status: "valid", reason: null, checkedAt: "x", holder: id(1) }, error: null });
  expect((await call("198.51.100.11")).status).toBe(503);
});
it("publishes only public keys, and answers 404 when signing is not configured", async () => {
  expect((await keysGet()).status).toBe(404);
  sign();
  const response = await keysGet(); expect(response.status).toBe(200);
  const body = await response.json(); const text = JSON.stringify(body);
  expect(body.issuer).toBe(ORIGIN); expect(body.keys).toEqual([{ kty: "OKP", crv: "Ed25519", x: keys.publicJwk.x, kid: "k1", use: "sig", alg: "EdDSA" }]);
  expect(text).not.toContain(keys.privateJwk.d as string);
});
it("lists the holder's credentials and reports whether signing is available", async () => {
  mocks.rpc.mockResolvedValue({ data: { items: [] }, error: null });
  expect((await (await listGet(new Request(base))).json()).data).toEqual({ signingConfigured: false, verifyBase: `${ORIGIN}/verify`, items: [], allowance: { planName: "Free worker protection", limit: 10, used: 0, remaining: 10 } }); // an unreadable plan reads as free
  sign(); expect((await (await listGet(new Request(base))).json()).data.signingConfigured).toBe(true);
  expect((await listGet(new Request(`${base}?holderId=${id(2)}`))).status).toBe(422);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await listGet(new Request(base))).status).toBe(401);
});
it("issue and revoke require sign-in and same origin, and reject extra or forged fields before doing anything", async () => {
  sign();
  const good = { workId: id(10), idempotencyKey: id(900) };
  for (const extra of [{ holderId: id(2) }, { assurance: "independently_reviewed" }, { token: "x" }, { lifetimeDays: 500 }]) expect((await issuePost(post("", { ...good, ...extra }))).status).toBe(422);
  expect((await issuePost(post("", good, "https://evil.example.test"))).status).toBe(403);
  expect((await revokePost(post("/revoke", { credentialId: id(3), holderId: id(2) }))).status).toBe(422);
  expect((await revokePost(post("/revoke", { credentialId: id(3) }, "https://evil.example.test"))).status).toBe(403);
  expect(mocks.work).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await issuePost(post("", good))).status).toBe(401); expect((await revokePost(post("/revoke", { credentialId: id(3) }))).status).toBe(401);
  expect(mocks.work).not.toHaveBeenCalled();
});
it("refuses to issue without a configured key and revokes only through the database's ownership check", async () => {
  expect((await issuePost(post("", { workId: id(10), idempotencyKey: id(900) }))).status).toBe(503);
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "NOT_FOUND", code: "P0001" } });
  expect((await revokePost(post("/revoke", { credentialId: id(3) }))).status).toBe(404);
  mocks.rpc.mockResolvedValue({ data: { credentialId: id(3), status: "revoked" }, error: null });
  expect((await (await revokePost(post("/revoke", { credentialId: id(3) }))).json()).data).toEqual({ credentialId: id(3), status: "revoked" });
  expect(mocks.rpc).toHaveBeenLastCalledWith("credential_revoke", { request: { credentialId: id(3) } });
});
it("applies the plan's credential limit before signing, and a plan read failure falls back to the free limit", async () => {
  sign();
  const active = (n: number) => ({ items: Array.from({ length: n }, (_, i) => ({ credentialId: id(100 + i), sourceId: id(10), sourceVersion: 1, assurance: "independently_reviewed", issuedAt: "2026-10-26T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z", token: "x".repeat(120), status: "valid", reason: null })) });
  const answer = (count: number, plan: string) => mocks.rpc.mockImplementation(async (name: string) => name === "credential_list" ? { data: active(count), error: null } : name === "entitlement_read" ? { data: { plan, assignedAt: null }, error: null } : { data: null, error: { message: "NOT_FOUND", code: "P0001" } });
  const attempt = () => issuePost(post("", { workId: id(10), idempotencyKey: id(900) }));
  answer(10, "worker_free"); expect((await attempt()).status).toBe(429); expect(mocks.work).not.toHaveBeenCalled();
  answer(10, "worker_plus"); mocks.work.mockRejectedValue(new Error("stop")); expect((await attempt()).status).not.toBe(429); expect(mocks.work).toHaveBeenCalled();
  answer(10, "platinum"); expect((await attempt()).status).toBe(429);
});

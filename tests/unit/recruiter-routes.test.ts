import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { limitFetches } from "@/server/recruiter/context";

const mocks = vi.hoisted(() => ({ signedIn: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/developer/session", () => ({ signedInClient: mocks.signedIn }));
import { GET, POST } from "@/app/api/v1/recruiter/route";
import { POST as decide } from "@/app/api/v1/recruiter/decide/route";
import { POST as remove } from "@/app/api/v1/recruiter/delete/route";
import { POST as claimDomain } from "@/app/api/v1/recruiter/domains/route";

const origin = "http://127.0.0.1:3100";
const post = (path: string, body: unknown, from = origin) => new Request(`${origin}${path}`, { method: "POST", headers: { origin: from, "content-type": "application/json" }, body: JSON.stringify(body) });
const claim = { recruiterName: "Asha Perera", claimedEmployer: "Acme Tools", noticeAcknowledged: true, idempotencyKey: crypto.randomUUID() };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", origin); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic");
  mocks.signedIn.mockResolvedValue({ userId: crypto.randomUUID(), rpc: mocks.rpc });
});
afterEach(() => vi.unstubAllEnvs());

it("refuses cross-origin writes before touching the session or the database", async () => {
  for (const [handler, path, body] of [[POST, "/api/v1/recruiter", claim], [decide, "/api/v1/recruiter/decide", {}], [remove, "/api/v1/recruiter/delete", {}], [claimDomain, "/api/v1/recruiter/domains", {}]] as const) {
    expect((await handler(post(path, body, "https://evil.example"))).status).toBe(403);
  }
  expect(mocks.signedIn).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("rejects unauthenticated callers", async () => {
  mocks.signedIn.mockRejectedValue(new AppError("AUTH_REQUIRED", 401));
  expect((await POST(post("/api/v1/recruiter", claim))).status).toBe(401);
  expect((await GET(new Request(`${origin}/api/v1/recruiter`))).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("validates the claim: acknowledgement is required and unknown fields are refused", async () => {
  expect((await POST(post("/api/v1/recruiter", { ...claim, noticeAcknowledged: false }))).status).toBe(422);
  expect((await POST(post("/api/v1/recruiter", { ...claim, ownerId: crypto.randomUUID() }))).status).toBe(422);
  expect((await POST(post("/api/v1/recruiter", { ...claim, profileUrl: "javascript:alert(1)" }))).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("refuses query strings on the list and malformed decisions", async () => {
  expect((await GET(new Request(`${origin}/api/v1/recruiter?x=1`))).status).toBe(422);
  expect((await decide(post("/api/v1/recruiter/decide", { verificationId: crypto.randomUUID(), decision: "confirm", reason: "ok", validDays: 400, idempotencyKey: crypto.randomUUID() }))).status).toBe(422);
  expect((await decide(post("/api/v1/recruiter/decide", { verificationId: "nope", decision: "approve", reason: "ok", validDays: null, idempotencyKey: crypto.randomUUID() }))).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("limits how often one person can make the server reach out to the internet", () => {
  const user = crypto.randomUUID();
  for (let at = 0; at < 20; at += 1) limitFetches(user, 1_000 + at);
  expect(() => limitFetches(user, 1_100)).toThrowError(expect.objectContaining({ status: 429 }));
  expect(() => limitFetches(user, 62_000)).not.toThrow();
  expect(() => limitFetches(crypto.randomUUID(), 1_100)).not.toThrow();
});

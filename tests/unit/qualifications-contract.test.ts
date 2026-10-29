import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { qualificationCommand, qualificationContent, qualificationPage } from "@/features/qualifications/schema";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), user: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.user }, rpc: mocks.rpc }) }));
import { GET, POST } from "@/app/api/v1/me/qualifications/route";

const ORIGIN = "http://127.0.0.1:3100";
const id = "11111111-1111-4111-8111-111111111111";
const content = { title: "Synthetic certificate", issuer: null, kind: "certificate", issuedOn: "2024-01", expiresOn: null, documentId: null };
const post = (body: unknown, origin = ORIGIN) => POST(new Request(`${ORIGIN}/api/v1/me/qualifications`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", ORIGIN); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic"); mocks.user.mockResolvedValue({ data: { user: { id: "u", is_anonymous: false } }, error: null }); });
afterEach(() => vi.unstubAllEnvs());

describe("qualification contract: self-reported data can never be presented as independently verified", () => {
  it("has no way to send or receive a 'verified' state", () => {
    for (const forged of [{ verification: "verified" }, { verified: true }, { independentlyVerified: true }, { status: "issuer_verified" }]) {
      expect(qualificationContent.safeParse({ ...content, ...forged }).success, JSON.stringify(forged)).toBe(false);
      expect(qualificationCommand.safeParse({ operation: "save", id, expectedRevision: 0, idempotencyKey: id, content, ...forged }).success, JSON.stringify(forged)).toBe(false);
    }
    const item = { id, revision: 1, content, savedAt: "2026-10-29T00:00:00Z", verification: "self_reported", independentlyVerified: false };
    expect(qualificationPage.safeParse({ items: [item], nextCursor: null }).success).toBe(true);
    expect(qualificationPage.safeParse({ items: [{ ...item, verification: "document_attached" }], nextCursor: null }).success).toBe(true);
    for (const claim of [{ verification: "verified" }, { verification: "issuer_verified" }, { independentlyVerified: true }]) expect(qualificationPage.safeParse({ items: [{ ...item, ...claim }], nextCursor: null }).success, JSON.stringify(claim)).toBe(false);
  });
});

describe("qualification route", () => {
  it("refuses anonymous callers, foreign origins and unknown fields before calling the database", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect((await post({ operation: "save", id, expectedRevision: 0, idempotencyKey: id, content })).status).toBe(401);
    mocks.user.mockResolvedValue({ data: { user: { id: "u", is_anonymous: false } }, error: null });
    expect((await post({ operation: "save", id, expectedRevision: 0, idempotencyKey: id, content }, "https://evil.example")).status).toBe(403);
    expect((await post({ operation: "save", id, expectedRevision: 0, idempotencyKey: id, content, ownerId: id })).status).toBe(422);
    expect((await GET(new Request(`${ORIGIN}/api/v1/me/qualifications?limit=5`))).status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("answers 503, not an invented result, while the database function does not exist yet or answers something off-contract", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function api.qualifications" } });
    expect((await GET(new Request(`${ORIGIN}/api/v1/me/qualifications`))).status).toBe(503);
    mocks.rpc.mockResolvedValue({ data: { items: [{ id, revision: 1, content, savedAt: "x", verification: "verified", independentlyVerified: true }], nextCursor: null }, error: null });
    expect((await GET(new Request(`${ORIGIN}/api/v1/me/qualifications`))).status).toBe(503);
  });
  it("passes a valid command through unchanged and maps database refusals to honest statuses", async () => {
    mocks.rpc.mockResolvedValue({ data: { id, revision: 1, saved: true }, error: null });
    const res = await post({ operation: "save", id, expectedRevision: 0, idempotencyKey: id, content });
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("qualifications", { request: { operation: "save", id, expectedRevision: 0, idempotencyKey: id, content } });
    for (const [message, status] of [["VERSION_CONFLICT", 409], ["EVIDENCE_REVOKED", 409], ["NOT_FOUND", 404], ["VALIDATION_FAILED", 422], ["RATE_LIMITED", 429]] as const) {
      mocks.rpc.mockResolvedValue({ data: null, error: { message } });
      expect((await post({ operation: "remove", id, expectedRevision: 1, idempotencyKey: id })).status, message).toBe(status);
    }
    expect(new AppError("AUTH_REQUIRED", 401).status).toBe(401);
  });
});

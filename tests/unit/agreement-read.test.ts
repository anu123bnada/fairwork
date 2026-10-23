import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: vi.fn(async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc })) }));
import { GET } from "@/app/api/v1/agreements/route";
const offerId = "40000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: offerId, is_anonymous: false } }, error: null });
});
describe("participant agreement read route", () => {
  it("rejects invalid, duplicate, missing and extra query fields before RPC", async () => {
    for (const query of ["", "offerId=bad", `offerId=${offerId}&offerId=${offerId}`, `offerId=${offerId}&workerId=${offerId}`]) {
      expect((await GET(new Request(`http://localhost/api/v1/agreements?${query}`))).status).toBe(422);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses anonymous sessions and missing sessions", async () => {
    for (const user of [null, { id: offerId, is_anonymous: true }]) {
      mocks.getUser.mockResolvedValue({ data: { user }, error: null });
      expect((await GET(new Request(`http://localhost/api/v1/agreements?offerId=${offerId}`))).status).toBe(401);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("maps missing/foreign IDs safely and prevents caching", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "NOT_FOUND" } });
    const response = await GET(new Request(`http://localhost/api/v1/agreements?offerId=${offerId}`));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("get_agreement", { request: { offerId } });
  });
  it("fails closed on unexpected database response fields", async () => {
    mocks.rpc.mockResolvedValue({ data: { rawSource: "must never reach the caller" }, error: null });
    const response = await GET(new Request(`http://localhost/api/v1/agreements?offerId=${offerId}`));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("rawSource");
  });
});

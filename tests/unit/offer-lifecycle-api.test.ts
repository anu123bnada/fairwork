import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { POST } from "@/app/api/v1/offers/lifecycle/route";
const input = () => ({ offerId: crypto.randomUUID(), archived: true, decision: "interested", expectedRevision: 0, idempotencyKey: crypto.randomUUID() });
const request = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/v1/offers/lifecycle", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  mocks.getUser.mockResolvedValue({ data: { user: { id: crypto.randomUUID(), is_anonymous: false } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { saved: true, revision: 1 }, error: null });
});
it("requires same-origin requests and rejects actor injection", async () => {
  expect((await POST(request(input(), "https://other.example"))).status).toBe(403);
  expect((await POST(request({ ...input(), actorId: crypto.randomUUID() }))).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires authenticated identity before the lifecycle RPC", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(request(input()))).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("passes validated revision and idempotency to the user-scoped RPC", async () => {
  const body = input();
  const response = await POST(request(body));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledWith("offer_lifecycle", { request: body });
});
it("does not claim success for malformed receipt or stale revision", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { saved: true }, error: null });
  expect((await POST(request(input()))).status).toBe(503);
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "VERSION_CONFLICT" } });
  expect((await POST(request(input()))).status).toBe(409);
});

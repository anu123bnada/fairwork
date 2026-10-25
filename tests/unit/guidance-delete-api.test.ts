import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { POST } from "../../src/app/api/v1/guidance/route";
const url = "http://localhost:3000/api/v1/guidance", thread = "40000000-0000-4000-8000-0000000000a1";
const post = (body: unknown, origin = "http://localhost:3000") => new Request(url, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); mocks.getUser.mockResolvedValue({ data: { user: { id: "worker" } }, error: null }); mocks.rpc.mockResolvedValue({ data: { threadId: thread, deleted: 2 }, error: null }); });
it("deletes through the dedicated RPC with a validated receipt", async () => {
  const response = await POST(post({ operation: "delete", threadId: thread }));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledWith("guidance_delete", { request: { operation: "delete", threadId: thread } });
});
it("rejects forged fields, cross-origin, anonymous and malformed receipts", async () => {
  expect((await POST(post({ operation: "delete", threadId: thread, actorId: "other" }))).status).toBe(422);
  expect((await POST(post({ operation: "delete", threadId: "not-a-uuid" }))).status).toBe(422);
  expect((await POST(post({ operation: "delete", threadId: thread }, "https://evil.invalid"))).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({ data: { threadId: thread, deleted: 5000 }, error: null });
  expect((await POST(post({ operation: "delete", threadId: thread }))).status).toBe(503);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(post({ operation: "delete", threadId: thread }))).status).toBe(401);
});

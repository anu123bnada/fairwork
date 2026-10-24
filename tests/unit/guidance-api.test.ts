import { beforeEach, expect, it, vi } from "vitest";
import { guidanceSend } from "../../src/features/guidance/schema";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { GET, POST } from "../../src/app/api/v1/guidance/route";
beforeEach(() => { vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); mocks.getUser.mockResolvedValue({ data: { user: { id: "worker" } }, error: null }); mocks.rpc.mockResolvedValue({ data: { threadId: null, threads: [], turns: [], providerAvailable: false }, error: null }); });
it("uses authenticated no-store history and rejects repeated or forged queries", async () => {
  const response = await GET(new Request("http://localhost:3000/api/v1/guidance")); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await GET(new Request("http://localhost:3000/api/v1/guidance?actorId=other"))).status).toBe(422);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await GET(new Request("http://localhost:3000/api/v1/guidance"))).status).toBe(401);
});
it("cannot enable AI, forge replies, or send cross-origin commands", async () => {
  expect(guidanceSend.safeParse({ operation: "send", threadId: crypto.randomUUID(), question: "Test", topic: "offer", offerId: null, idempotencyKey: crypto.randomUUID(), response: "approved" }).success).toBe(false);
  mocks.rpc.mockResolvedValue({ data: { threadId: null, threads: [], turns: [], providerAvailable: true }, error: null });
  expect((await GET(new Request("http://localhost:3000/api/v1/guidance"))).status).toBe(503);
  expect((await POST(new Request("http://localhost:3000/api/v1/guidance", { method: "POST", headers: { origin: "https://evil.invalid" } }))).status).toBe(403);
});

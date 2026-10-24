import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { GET, POST } from "../../src/app/api/v1/opportunities/route";
beforeEach(() => { vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); mocks.getUser.mockResolvedValue({ data: { user: { id: "worker" } }, error: null }); mocks.rpc.mockResolvedValue({ data: { items: [], nextCursor: null, preferences: null, preferenceVersion: 0 }, error: null }); });
it("requires authenticated identity, strict queries and no-store reads", async () => {
  const response = await GET(new Request("http://localhost:3000/api/v1/opportunities"));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await GET(new Request("http://localhost:3000/api/v1/opportunities?view=mine&view=discover"))).status).toBe(422);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET(new Request("http://localhost:3000/api/v1/opportunities"))).status).toBe(401);
});
it("rejects cross-origin writes and unexpected server fields", async () => {
  expect((await POST(new Request("http://localhost:3000/api/v1/opportunities", { method: "POST", headers: { origin: "https://evil.invalid" } }))).status).toBe(403);
  mocks.rpc.mockResolvedValue({ data: { items: [], nextCursor: null, preferences: null, preferenceVersion: 0, privateNotes: "secret" }, error: null });
  const result = await GET(new Request("http://localhost:3000/api/v1/opportunities")); expect(result.status).toBe(503); expect(await result.text()).not.toContain("secret");
});

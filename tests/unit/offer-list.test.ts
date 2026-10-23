import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { GET } from "@/app/api/v1/offers/route";
const request = (query = "") => new Request(`http://localhost/api/v1/offers${query}`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: crypto.randomUUID(), is_anonymous: false } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { items: [], nextCursor: null }, error: null });
});
it("requires verified authentication before listing", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET(request())).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects actor injection, invalid cursors, and duplicate filters", async () => {
  for (const query of ["?workerId=forged", "?cursor=invalid", "?context=admin", "?context=WORKER&context=EMPLOYER"]) expect((await GET(request(query))).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("passes only bounded context and cursor to RLS-protected function", async () => {
  const cursor = crypto.randomUUID();
  const response = await GET(request(`?context=EMPLOYER&cursor=${cursor}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledWith("list_offers", { request: { context: "EMPLOYER", cursor } });
});
it("fails closed for malformed database output", async () => {
  mocks.rpc.mockResolvedValue({ data: { items: [{ privateData: "not allowed" }], nextCursor: null }, error: null });
  expect((await GET(request())).status).toBe(503);
});

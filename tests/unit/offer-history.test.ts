import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { GET } from "@/app/api/v1/offers/history/route";
const id = "40000000-0000-4000-8000-000000000001";
const request = (query = `offerId=${id}`) => new Request(`http://localhost/api/v1/offers/history?${query}`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id, is_anonymous: false } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { offerId: id, items: [], nextCursor: null }, error: null });
});
it("requires a verified non-anonymous identity before history disclosure", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET(request())).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects injected identity, invalid bounds and duplicate keys", async () => {
  for (const query of [`offerId=${id}&workerId=${id}`, `offerId=${id}&beforeVersion=0`, `offerId=${id}&beforeVersion=1.5`, `offerId=${id}&beforeVersion=99999999999999999999`, `offerId=${id}&offerId=${id}`, "offerId=bad"]) expect((await GET(request(query))).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("forwards only the validated selection and denies unexpected private output", async () => {
  const response = await GET(request(`offerId=${id}&beforeVersion=21`));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledWith("offer_history", { request: { offerId: id, beforeVersion: 21 } });
  mocks.rpc.mockResolvedValue({ data: { offerId: id, items: [], nextCursor: null, sourceText: "private" }, error: null });
  expect((await GET(request())).status).toBe(503);
});

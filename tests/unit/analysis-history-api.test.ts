import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), readAgreement: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/server/offer", () => ({ readAgreement: mocks.readAgreement }));
import { GET, POST } from "@/app/api/v1/offers/analyses/route";
import { assessOfferTerms } from "@/features/offer/assessment";
const url = "http://localhost:3000/api/v1/offers/analyses", offerId = "40000000-0000-4000-8000-0000000000c1", key = "40000000-0000-4000-8000-0000000000c2";
const termHash = "b".repeat(64), snapshot = { role: "Technician", salary: "80000", currency: "LKR", hoursPerWeek: "40" };
const post = (body: unknown, origin = "http://localhost:3000") => new Request(url, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "worker" } }, error: null });
  mocks.readAgreement.mockResolvedValue({ offer: { offerId, version: 3, termHash, snapshot } });
  mocks.rpc.mockResolvedValue({ data: { id: key, saved: true }, error: null });
});
it("recomputes the analysis on the server and binds it to the live revision and hash", async () => {
  const response = await POST(post({ offerId, idempotencyKey: key }));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  const expected = assessOfferTerms(snapshot as never);
  expect(mocks.rpc).toHaveBeenCalledWith("analysis_history", { request: { operation: "save", offerId, offerVersion: 3, termHash, engine: expected.version, score: expected.score, result: expected, idempotencyKey: key } });
});
it("refuses client-supplied results, forged fields, cross-origin and anonymous calls", async () => {
  for (const extra of [{ result: { score: 100 } }, { score: 100 }, { offerVersion: 9 }, { termHash: "c".repeat(64) }, { actorId: "other" }])
    expect((await POST(post({ offerId, idempotencyKey: key, ...extra }))).status).toBe(422);
  expect((await POST(post({ offerId, idempotencyKey: "bad" }))).status).toBe(422);
  expect((await POST(post({ offerId, idempotencyKey: key }, "https://evil.invalid"))).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(post({ offerId, idempotencyKey: key }))).status).toBe(401);
});
it("lists only through the offer-scoped query and validates the stored shape", async () => {
  mocks.rpc.mockResolvedValue({ data: { offerId, items: [] }, error: null });
  expect((await GET(new Request(`${url}?offerId=${offerId}`))).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("analysis_history", { request: { operation: "list", offerId } });
  for (const query of ["", "?offerId=bad", `?offerId=${offerId}&actorId=x`]) expect((await GET(new Request(`${url}${query}`))).status).toBe(422);
  mocks.rpc.mockResolvedValue({ data: { offerId, items: [{ id: key, score: 999 }] }, error: null });
  expect((await GET(new Request(`${url}?offerId=${offerId}`))).status).toBe(503);
});

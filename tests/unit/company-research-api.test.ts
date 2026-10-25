import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), search: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/server/research/gleif", async () => {
  const actual = await vi.importActual<typeof import("@/server/research/gleif")>("@/server/research/gleif");
  return { ...actual, searchGleif: mocks.search };
});
import { GET } from "@/app/api/v1/research/companies/route";
import { toRegistryRecord } from "@/server/research/gleif";
const url = "http://localhost:3000/api/v1/research/companies";
const lei = { id: "254900XV5B725ZG6RS07", attributes: { entity: { legalName: { name: "Commercial Bank of Ceylon PLC" }, otherNames: [], legalAddress: { country: "LK", city: "Colombo", addressLines: [] }, status: "ACTIVE", jurisdiction: "LK" }, registration: { status: "ISSUED", lastUpdateDate: new Date().toISOString(), nextRenewalDate: "2099-01-01T00:00:00Z", corroborationLevel: "FULLY_CORROBORATED" } } };
let user = 0;
beforeEach(() => {
  vi.resetAllMocks(); user++;
  mocks.getUser.mockResolvedValue({ data: { user: { id: `user-${user}` } }, error: null });
  mocks.search.mockResolvedValue({ records: [toRegistryRecord(lei as never, new Date().toISOString())], total: 1 });
});
it("returns cited, labelled evidence with limitations and no score", async () => {
  const response = await GET(new Request(`${url}?name=Commercial%20Bank%20of%20Ceylon&country=lk`));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  const body = (await response.json()).data;
  expect(body.source).toMatchObject({ provider: "gleif", kind: "third_party_registry" });
  expect(body.results[0]).toMatchObject({ nameMatch: "close", record: { sourceUrl: expect.stringContaining("api.gleif.org"), retrievedAt: expect.any(String) } });
  expect(body.limitations.length).toBeGreaterThan(0); expect(JSON.stringify(body)).not.toMatch(/trustScore|"score"/);
  expect(mocks.search).toHaveBeenCalledWith({ name: "Commercial Bank of Ceylon", country: "LK" });
});
it("states plainly that no record is not evidence of anything", async () => {
  mocks.search.mockResolvedValue({ records: [], total: 0 });
  const body = (await (await GET(new Request(`${url}?name=Tiny%20Local%20Employer`))).json()).data;
  expect(body.results).toEqual([]); expect(body.limitations[0]).toMatch(/not evidence of anything/);
});
it("requires authentication and rejects malformed, repeated or extra parameters before any lookup", async () => {
  for (const query of ["", "?name=a", `?name=${"x".repeat(121)}`, "?name=Acme&country=LKA", "?name=Acme&name=Other", "?name=Acme&actorId=1", "?name=Acme&filter[x]=1"]) expect((await GET(new Request(`${url}${query}`))).status).toBe(422);
  expect(mocks.search).not.toHaveBeenCalled();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET(new Request(`${url}?name=Acme%20Ltd`))).status).toBe(401);
  expect(mocks.search).not.toHaveBeenCalled();
});
it("limits each user's lookups and maps provider failure to a safe error", async () => {
  for (let i = 0; i < 12; i++) expect((await GET(new Request(`${url}?name=Acme%20${i}`))).status).toBe(200);
  expect((await GET(new Request(`${url}?name=Acme%20again`))).status).toBe(429);
  user++; mocks.getUser.mockResolvedValue({ data: { user: { id: `user-${user}` } }, error: null });
  const { AppError } = await import("@/lib/errors");
  mocks.search.mockRejectedValue(new AppError("SERVICE_UNAVAILABLE", 503));
  const failed = await GET(new Request(`${url}?name=Acme%20Ltd`));
  expect(failed.status).toBe(503); expect(JSON.stringify(await failed.json())).not.toContain("gleif");
});

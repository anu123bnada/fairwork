import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), work: vi.fn(), listOffers: vi.fn(), readAgreement: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/server/work", () => ({ workService: mocks.work }));
vi.mock("@/server/offer", () => ({ listOffers: mocks.listOffers, readAgreement: mocks.readAgreement }));
import { GET } from "@/app/api/v1/trust-chain/route";
const url = "http://localhost:3000/api/v1/trust-chain";
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const entry = { id: id(1), revision: 1, savedAt: "2026-10-20T00:00:00Z", verification: "self_reported", content: { employer: "Synthetic Works", role: "Technician", startDate: "2021-03", endDate: null, current: true, skills: [], achievements: "" } };
const record = (n: number) => ({ workId: id(n), agreementId: id(5), workerId: id(1), companyId: id(3), representativeId: id(2), currentVersion: 1, integrityEvents: [], versions: [{ version: 1, state: "submitted", contentHash: "a".repeat(64), evidenceHash: "b".repeat(64), createdAt: "2026-10-01T10:00:00+00:00", submittedAt: "2026-10-01T11:00:00+00:00", decision: null, content: { role: "Welder", periodStart: "2026-10-01", periodEnd: "2026-10-02", hours: "16", tasks: "Welding", evidence: [], schemaVersion: "work-record.v1", agreement: { id: id(5), version: 1, contentHash: "c".repeat(64), authorityDecisionId: id(6), effectiveAt: "2026-10-01T00:00:00+00:00", scope: "Engineering" } } }] });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: id(1) } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { items: [entry], nextCursor: null }, error: null });
  mocks.work.mockImplementation(async (request: Record<string, unknown>) => "workId" in request ? record(Number((request.workId as string).slice(-3))) : { items: [{ workId: id(10) }, { workId: id(11) }].map(i => ({ ...i, version: 1, state: "submitted", hours: "16", periodStart: "2026-10-01", periodEnd: "2026-10-02" })), nextCursor: null });
  mocks.listOffers.mockResolvedValue({ items: [], nextCursor: null });
});
it("composes only the caller's authorized records into a private, validated chain", async () => {
  const response = await GET(new Request(url));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  const body = (await response.json()).data;
  expect(body.counts).toMatchObject({ total: 3, selfReported: 3, independentlyReviewed: 0 }); expect(body.sources).toEqual({ employmentEntries: 1, workRecords: 2, offers: 0 });
  expect(body.truncated).toBe(false);
  expect(mocks.rpc).toHaveBeenCalledWith("employment_history", { request: { operation: "list", cursor: null } });
  expect(mocks.listOffers).toHaveBeenCalledWith({ context: "WORKER", cursor: null, view: "all" });
  expect(JSON.stringify(body)).not.toContain(id(2)); // no other person's identifier
});
it("excludes records the caller only reviews as a representative, so they are never shown as the caller's own claims", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: id(2) } }, error: null }); // id(2) is the representative on every fixture record
  const body = (await (await GET(new Request(url))).json()).data;
  expect(body.sources.workRecords).toBe(0); expect(body.claims.filter((c: { type: string }) => c.type === "work_performed")).toEqual([]);
});
it("reports unreadable or over-limit sources as truncated instead of hiding them", async () => {
  mocks.work.mockImplementation(async (request: Record<string, unknown>) => { if ("workId" in request) { if (request.workId === id(11)) throw new Error("denied"); return record(10); } return { items: [{ workId: id(10) }, { workId: id(11) }].map(i => ({ ...i, version: 1, state: "submitted", hours: "1", periodStart: "2026-10-01", periodEnd: "2026-10-01" })), nextCursor: null }; });
  const body = (await (await GET(new Request(url))).json()).data;
  expect(body.sources.workRecords).toBe(1); expect(body.truncated).toBe(true);
  mocks.listOffers.mockResolvedValue({ items: [], nextCursor: id(99) });
  expect((await (await GET(new Request(url))).json()).data.truncated).toBe(true);
});
it("rejects query parameters and anonymous callers before reading anything", async () => {
  expect((await GET(new Request(`${url}?workerId=${id(9)}`))).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.work).not.toHaveBeenCalled();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET(new Request(url))).status).toBe(401);
  expect(mocks.work).not.toHaveBeenCalled(); expect(mocks.listOffers).not.toHaveBeenCalled();
});
it("treats a source that returns an unexpected shape as unavailable", async () => {
  mocks.rpc.mockResolvedValue({ data: { items: [{ ...entry, verification: "verified" }], nextCursor: null }, error: null });
  expect((await GET(new Request(url))).status).toBe(503);
});

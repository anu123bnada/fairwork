import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFindings, nameMatch, nameTokens, sourceFreshness } from "@/features/research/analysis";
import { registryRecord, type RegistryRecord } from "@/features/research/schema";
import { clearResearchCache, getGleifRecord, searchGleif, toRegistryRecord } from "@/server/research/gleif";

const NOW = new Date("2026-10-26T00:00:00Z");
// Shape mirrors a real GLEIF record (fields observed live on 26 Oct 2026); values are test fixtures.
const apiRecord = (over: Record<string, unknown> = {}, regOver: Record<string, unknown> = {}) => ({
  id: "254900XV5B725ZG6RS07", type: "lei-records",
  attributes: {
    lei: "254900XV5B725ZG6RS07",
    entity: { legalName: { name: "Commercial Bank of Ceylon PLC", language: "en" }, otherNames: [], legalAddress: { addressLines: ["21, Bristol Street"], city: "Colombo", region: "LK-11", country: "LK", postalCode: "00100" }, registeredAt: { id: "RA000540" }, registeredAs: "PQ116", jurisdiction: "LK", legalForm: { id: "9999", other: "Public Limited Company" }, status: "ACTIVE", ...over },
    registration: { status: "ISSUED", lastUpdateDate: "2026-09-01T18:13:29Z", nextRenewalDate: "2027-09-04T19:37:18Z", corroborationLevel: "FULLY_CORROBORATED", ...regOver },
  },
});
const record = (over: Record<string, unknown> = {}, regOver: Record<string, unknown> = {}): RegistryRecord => toRegistryRecord(apiRecord(over, regOver) as never, NOW.toISOString());
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("name comparison", () => {
  it("ranks exact, suffix-insensitive and partial matches and refuses to over-match", () => {
    const r = record();
    expect(nameMatch("Commercial Bank of Ceylon PLC", r)).toBe("exact");
    expect(nameMatch("commercial bank of ceylon", r)).toBe("close");
    expect(nameMatch("Ceylon Commercial Bank", r)).toBe("partial");
    expect(nameMatch("Hatton National Bank", r)).toBe("weak");
    expect(nameTokens("Müller & Söhne GmbH")).toEqual(["muller", "and", "sohne"]);
  });
});
describe("findings are explainable and never numeric", () => {
  it("reports supporting facts and the scope limitation for a healthy record", () => {
    const findings = buildFindings(record(), { name: "Commercial Bank of Ceylon", country: "LK" }, NOW);
    expect(findings.map(f => f.id)).toEqual(expect.arrayContaining(["name-match", "entity-active", "corroboration", "scope"]));
    expect(findings.find(f => f.id === "scope")!.kind).toBe("limitation");
    expect(JSON.stringify(findings)).not.toMatch(/score|trust level|\d+\s*\/\s*100/i);
  });
  it("flags contradictions and outdated registry data instead of hiding them", () => {
    const findings = buildFindings(record({ status: "INACTIVE" }, { status: "LAPSED", nextRenewalDate: "2026-01-01T00:00:00Z", lastUpdateDate: "2023-01-01T00:00:00Z" }), { name: "Totally Different Name", country: "DE" }, NOW);
    const kinds = Object.fromEntries(findings.map(f => [f.id, f.kind]));
    expect(kinds).toMatchObject({ "name-match": "contradicts", "country-mismatch": "contradicts", "entity-status": "contradicts", "registration-status": "outdated", "renewal-overdue": "outdated", "source-age": "outdated" });
  });
  it("computes freshness and a 30-day re-verification date", () => {
    expect(sourceFreshness({ sourceLastUpdated: "2026-09-01T00:00:00Z", retrievedAt: "2026-10-26T00:00:00Z" }, NOW)).toMatchObject({ status: "current", sourceAgeDays: 55, verifyAgainBy: "2026-11-25T00:00:00.000Z" });
    expect(sourceFreshness({ sourceLastUpdated: null, retrievedAt: "x" }, NOW)).toMatchObject({ status: "unknown", sourceAgeDays: null, verifyAgainBy: null });
  });
});
describe("GLEIF provider", () => {
  beforeEach(() => clearResearchCache());
  it("normalizes a registry record with a citable source URL and timestamp", () => {
    const r = record();
    expect(registryRecord.safeParse(r).success).toBe(true);
    expect(r).toMatchObject({ identifier: { scheme: "LEI", value: "254900XV5B725ZG6RS07" }, country: "LK", legalForm: "Public Limited Company", registrationAuthority: { id: "RA000540", entityId: "PQ116" }, sourceUrl: "https://api.gleif.org/api/v1/lei-records/254900XV5B725ZG6RS07", retrievedAt: NOW.toISOString() });
    expect(r.legalAddress).toBe("21, Bristol Street, Colombo, 00100, LK");
  });
  it("searches a fixed host with encoded parameters, bounded options, and caches repeats", async () => {
    const fetchImpl = vi.fn(async () => reply({ data: [apiRecord()], meta: { pagination: { total: 1 } } }));
    const first = await searchGleif({ name: "Bank & Co <script>", country: "LK" }, { fetchImpl: fetchImpl as never, now: () => NOW.getTime() });
    await searchGleif({ name: "Bank & Co <script>", country: "LK" }, { fetchImpl: fetchImpl as never, now: () => NOW.getTime() + 1000 });
    expect(first.total).toBe(1); expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://api.gleif.org/api/v1/lei-records");
    expect(parsed.searchParams.get("filter[fulltext]")).toBe("Bank & Co <script>"); expect(parsed.searchParams.get("filter[entity.legalAddress.country]")).toBe("LK");
    expect(init).toMatchObject({ redirect: "error", cache: "no-store" });
    await searchGleif({ name: "Bank & Co <script>", country: "LK" }, { fetchImpl: fetchImpl as never, now: () => NOW.getTime() + 16 * 60_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("maps provider failures to safe errors and rejects malformed or oversized data", async () => {
    const run = (fetchImpl: unknown) => searchGleif({ name: "Some Company", country: null }, { fetchImpl: fetchImpl as never });
    await expect(run(async () => reply({}, 429))).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(run(async () => reply({}, 500))).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(run(async () => { throw new Error("socket secret detail"); })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(run(async () => reply({ data: [{ id: "not-a-lei" }] }))).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(run(async () => new Response("x".repeat(1_100_000)))).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(run(async () => new Response("<html>gateway</html>"))).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
  it("looks up one LEI, returns null for unknown records and refuses malformed identifiers", async () => {
    expect(await getGleifRecord("254900XV5B725ZG6RS07", { fetchImpl: (async () => reply({ data: apiRecord() })) as never })).toMatchObject({ legalName: "Commercial Bank of Ceylon PLC" });
    expect(await getGleifRecord("254900XV5B725ZG6RS08", { fetchImpl: (async () => reply({}, 404)) as never })).toBeNull();
    await expect(getGleifRecord("../../etc/passwd")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

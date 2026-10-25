// LIVE check of the company research provider against the real GLEIF registry (public data, no
// credentials, no user data). Run: npm run test:live:research
import dns from "node:dns";
import { expect, it } from "vitest";
import { buildFindings } from "@/features/research/analysis";
dns.setDefaultResultOrder("ipv4first");

it("finds a real Sri Lankan company with cited evidence", async () => {
  const { searchGleif } = await import("@/server/research/gleif");
  const { records, total } = await searchGleif({ name: "Commercial Bank of Ceylon", country: "LK" });
  const hit = records.find(r => r.identifier.value === "254900XV5B725ZG6RS07");
  console.log(JSON.stringify({ total, found: hit && { name: hit.legalName, country: hit.country, status: hit.entityStatus, authority: hit.registrationAuthority, corroboration: hit.corroboration, source: hit.sourceUrl, retrievedAt: hit.retrievedAt } }));
  expect(hit).toBeDefined();
  expect(hit!.country).toBe("LK"); expect(hit!.sourceUrl).toBe("https://api.gleif.org/api/v1/lei-records/254900XV5B725ZG6RS07");
  const findings = buildFindings(hit!, { name: "Commercial Bank of Ceylon", country: "LK" }, new Date());
  console.log(findings.map(f => `${f.kind}: ${f.title}`).join(" | "));
  expect(findings.some(f => f.id === "scope")).toBe(true);
}, 60000);
it("finds a real German company and reports a country mismatch when the user expected another country", async () => {
  const { searchGleif } = await import("@/server/research/gleif");
  const { records } = await searchGleif({ name: "Siemens Aktiengesellschaft", country: null });
  const siemens = records.find(r => r.identifier.value === "W38RGI023J3WT1HWRP32");
  expect(siemens).toBeDefined(); expect(siemens!.country).toBe("DE");
  expect(buildFindings(siemens!, { name: "Siemens Aktiengesellschaft", country: "LK" }, new Date()).some(f => f.id === "country-mismatch")).toBe(true);
}, 60000);
it("reports no results honestly for a name that is not in the registry", async () => {
  const { searchGleif } = await import("@/server/research/gleif");
  const { records, total } = await searchGleif({ name: "Zzqx Nonexistent Employer 98431", country: null });
  expect(records).toEqual([]); expect(total).toBe(0);
}, 60000);

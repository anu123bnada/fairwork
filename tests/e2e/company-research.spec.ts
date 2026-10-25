import { expect, test, type Page } from "@playwright/test";
const id = "40000000-0000-4000-8000-000000000001";
const record = {
  provider: "gleif", providerName: "GLEIF Global LEI Index", identifier: { scheme: "LEI", value: "254900XV5B725ZG6RS07" },
  legalName: "Commercial Bank of Ceylon PLC", otherNames: [], country: "LK", jurisdiction: "LK", legalForm: "Public Limited Company",
  entityStatus: "ACTIVE", registrationStatus: "ISSUED", corroboration: "FULLY_CORROBORATED", registrationAuthority: { id: "RA000540", entityId: "PQ116" },
  legalAddress: "21, Bristol Street, Colombo, 00100, LK", sourceLastUpdated: "2026-09-01T18:13:29Z", nextRenewal: "2027-09-04T19:37:18Z",
  sourceUrl: "https://api.gleif.org/api/v1/lei-records/254900XV5B725ZG6RS07", retrievedAt: "2026-10-26T09:00:00Z",
};
const source = { provider: "gleif", name: "GLEIF Global LEI Index", url: "https://www.gleif.org/en/lei-data/gleif-api", kind: "third_party_registry" };
async function employer(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/organizations", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
}
test("employer research shows cited registry evidence, separates findings and never shows a score", async ({ page }) => {
  await employer(page);
  const queries: string[] = [];
  await page.route("**/api/v1/research/companies?*", route => {
    queries.push(new URL(route.request().url()).search);
    return route.fulfill({ json: { data: { query: { name: "Commercial Bank of Ceylon", country: "LK" }, totalMatches: 1, source, limitations: ["Data comes from the GLEIF Global LEI Index, a third-party registry. It is not complete."], results: [{
      record, nameMatch: "close", freshness: { status: "current", sourceAgeDays: 55, verifyAgainBy: "2026-11-25T09:00:00.000Z" },
      findings: [
        { id: "name-match", kind: "supports", title: "Registered name matches apart from the legal-form suffix", detail: "A matching name does not prove that a job offer belongs to this entity." },
        { id: "entity-active", kind: "supports", title: "Registry lists the entity as active", detail: "This concerns the registry status only." },
        { id: "scope", kind: "limitation", title: "What this research does not establish", detail: "It does not verify that this entity made a specific offer." }] }] } } });
  });
  await page.goto("/app/employer");
  const panel = page.getByRole("region", { name: "Employer research" });
  await panel.getByLabel("Company name").fill("Commercial Bank of Ceylon");
  await panel.getByLabel("Country").selectOption("LK");
  await panel.getByRole("button", { name: "Search registry" }).click();
  const card = panel.getByRole("article", { name: "Registry record: Commercial Bank of Ceylon PLC" });
  await expect(card).toContainText("Registry record, not verified by ORYQEN");
  await expect(card).toContainText("LEI 254900XV5B725ZG6RS07"); await expect(card).toContainText("RA000540");
  await expect(card.getByRole("link", { name: /GLEIF Global LEI Index record/ })).toHaveAttribute("href", record.sourceUrl);
  await expect(card.getByRole("link", { name: /GLEIF/ })).toHaveAttribute("rel", /noopener/);
  await expect(card).toContainText("Supports:"); await expect(card).toContainText("Limit of this check:");
  await expect(card).toContainText("re-check by");
  await expect(panel).not.toContainText(/trust score|\d+\s*\/\s*100|\d+\s*%/i);
  expect(queries).toEqual(["?name=Commercial+Bank+of+Ceylon&country=LK"]);
});
test("a search with no registry match says it proves nothing, and a failure shows a safe error", async ({ page }) => {
  await employer(page);
  let calls = 0;
  await page.route("**/api/v1/research/companies?*", route => ++calls === 1
    ? route.fulfill({ json: { data: { query: { name: "Tiny Local Employer", country: null }, totalMatches: 0, results: [], source, limitations: ["No registry record was found. Many genuine employers have no LEI, so this is not evidence of anything either way."] } } })
    : route.fulfill({ status: 429, json: { error: { code: "RATE_LIMITED" } } }));
  await page.goto("/app/employer");
  const panel = page.getByRole("region", { name: "Employer research" });
  await panel.getByLabel("Company name").fill("Tiny Local Employer");
  await panel.getByRole("button", { name: "Search registry" }).click();
  await expect(panel.getByText(/No registry record found for/)).toBeVisible();
  await panel.getByText("Limits of this research").click();
  await expect(panel).toContainText("not evidence of anything either way");
  await panel.getByRole("button", { name: "Search registry" }).click();
  await expect(panel.locator("p[role=alert]")).toBeVisible(); await expect(panel.getByRole("article")).toHaveCount(0);
});

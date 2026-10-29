import { expect, test, type Page } from "@playwright/test";
import { translate } from "../../src/i18n";

const id = "40000000-0000-4000-8000-000000000001";
const record = {
  provider: "gleif", providerName: "GLEIF Global LEI Index", identifier: { scheme: "LEI", value: "254900XV5B725ZG6RS07" },
  legalName: "Commercial Bank of Ceylon PLC", otherNames: [], country: "LK", jurisdiction: "LK", legalForm: "Public Limited Company",
  entityStatus: "ACTIVE", registrationStatus: "ISSUED", corroboration: "FULLY_CORROBORATED", registrationAuthority: { id: "RA000540", entityId: "PQ116" },
  legalAddress: "21, Bristol Street, Colombo, 00100, LK", sourceLastUpdated: "2026-09-01T18:13:29Z", nextRenewal: "2027-09-04T19:37:18Z",
  sourceUrl: "https://api.gleif.org/api/v1/lei-records/254900XV5B725ZG6RS07", retrievedAt: "2026-10-26T09:00:00Z",
};
const source = { provider: "gleif", name: "GLEIF Global LEI Index", url: "https://www.gleif.org/en/lei-data/gleif-api", kind: "third_party_registry" };

async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: [
    { offerId: "50000000-0000-4000-8000-000000000001", companyId: id, version: 2, role: "Maintenance technician", createdAt: "2026-10-20T00:00:00Z", questions: 3, decision: "considering", lifecycleRevision: 0 },
    { offerId: "50000000-0000-4000-8000-000000000002", companyId: id, version: 1, role: null, createdAt: "2026-10-21T00:00:00Z", questions: 0 },
  ], nextCursor: null } } }));
  await page.route("**/api/v1/research/companies?*", route => route.fulfill({ json: { data: { query: { name: "Commercial Bank of Ceylon", country: "LK" }, totalMatches: 1, source, limitations: ["Data comes from the GLEIF Global LEI Index."], results: [{
    record, nameMatch: "close", freshness: { status: "current", sourceAgeDays: 55, verifyAgainBy: "2026-11-25T09:00:00.000Z" },
    findings: [{ id: "scope", kind: "limitation", title: "What this research does not establish", detail: "It does not verify that this entity made a specific offer." }] }] } } }));
}

for (const locale of ["si", "ta", "de"] as const) {
  test(`saved offers and company research are translated in ${locale}, with no leftover keys and no phone overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page);
    await page.goto("/app/settings");
    await page.getByLabel("Language").selectOption(locale);
    await page.goto("/app/home");

    const offers = page.getByRole("region", { name: translate(locale, "offers.region") });
    await expect(offers.getByRole("heading", { name: translate(locale, "offers.title") })).toBeVisible();
    await expect(offers).toContainText(translate(locale, "offers.privacy"));
    await expect(offers).toContainText(translate(locale, "offers.revision", { version: 2, count: 3 }));
    await expect(offers).toContainText(translate(locale, "offers.untitled"));
    await expect(offers.getByRole("checkbox", { name: translate(locale, "offers.compareAria", { role: "Maintenance technician" }) })).toBeVisible();
    await expect(offers.getByRole("link", { name: translate(locale, "offers.open") }).first()).toBeVisible();
    await expect(offers.getByRole("button", { name: translate(locale, "offers.archive") }).first()).toBeVisible();
    await expect(offers.getByRole("combobox", { name: translate(locale, "offers.decisionFor", { role: "Maintenance technician" }) })).toBeVisible();
    await expect(offers.getByRole("option", { name: translate(locale, "offers.accepted") }).first()).toBeAttached();

    await page.getByRole("tab").nth(2).click();
    const panel = page.getByRole("region", { name: translate(locale, "research.title") });
    await panel.getByLabel(translate(locale, "research.companyName")).fill("Commercial Bank of Ceylon");
    await panel.getByLabel(translate(locale, "research.country")).selectOption("LK");
    await expect(panel.getByRole("option", { name: translate(locale, "research.anyCountry") })).toBeAttached();
    await panel.getByRole("button", { name: translate(locale, "research.search") }).click();
    const card = panel.getByRole("article", { name: translate(locale, "research.recordAria", { name: "Commercial Bank of Ceylon PLC" }) });
    await expect(card).toContainText(translate(locale, "research.notVerified"));
    for (const key of ["research.identifier", "research.registry", "research.address", "research.updated", "research.retrieved", "research.source"] as const) await expect(card).toContainText(translate(locale, key));
    await expect(card).toContainText(translate(locale, "research.kindLimitation"));
    await expect(panel.getByRole("status").filter({ hasText: translate(locale, "research.showingOne", { shown: 1, total: 1, query: "Commercial Bank of Ceylon" }) })).toBeVisible();

    await expect(page.locator("body")).not.toContainText(/\b(?:offers|research|home|plan|vault)\.[a-zA-Z]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${locale} overflow`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`panels-${locale}.png`), fullPage: true });
  });
}

test("an expiring credential produces a translated reminder on the home screen, and nothing appears when none is near", async ({ page }) => {
  await signedIn(page);
  const soon = new Date(Date.now() + 5 * 86_400_000).toISOString(), far = new Date(Date.now() + 60 * 86_400_000).toISOString();
  let items = [{ credentialId: id, status: "valid", expiresAt: soon }, { credentialId: "50000000-0000-4000-8000-000000000009", status: "valid", expiresAt: far }];
  await page.route("**/api/v1/credentials", route => route.fulfill({ json: { data: { signingConfigured: true, verifyBase: "http://localhost/verify", items } } }));
  await page.goto("/app/settings");
  await page.getByLabel("Language").selectOption("de");
  await page.goto("/app/home");
  const reminders = page.getByRole("region", { name: translate("de", "reminders.title") });
  await expect(reminders).toContainText(translate("de", "reminders.expiresMany", { days: 5, date: "" }).split("(")[0]!.trim());
  await expect(reminders.getByRole("listitem")).toHaveCount(1);
  await expect(reminders.getByRole("link", { name: translate("de", "reminders.open") })).toHaveAttribute("href", "/app/passport");
  items = [items[1]!];
  await page.reload();
  await expect(page.getByRole("heading", { name: translate("de", "home.greeting", { name: "Synthetic" }) })).toBeVisible();
  await expect(page.getByRole("region", { name: translate("de", "reminders.title") })).toHaveCount(0);
});

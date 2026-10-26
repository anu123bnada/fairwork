import { expect, test, type Page } from "@playwright/test";
import { translate, type LocaleCode } from "../../src/i18n";

const id = "40000000-0000-4000-8000-000000000001";
async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers/drafts**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
}

for (const locale of ["si", "ta", "de"] as LocaleCode[]) {
  test(`the add-offer screen is translated in ${locale}, including labels, notes and the submit button`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page);
    await page.goto("/app/settings");
    await page.getByLabel("Language").selectOption(locale);
    await page.goto("/app/add-offer");
    await expect(page.getByRole("heading", { name: translate(locale, "add.title") })).toBeVisible();
    await expect(page.getByText(translate(locale, "add.subtitle"))).toBeVisible();
    const tabs = page.getByRole("tablist", { name: translate(locale, "add.methodAria") });
    for (const key of ["add.tabPaste", "add.tabScreenshot", "add.tabManual"] as const) await expect(tabs.getByRole("tab", { name: translate(locale, key) })).toBeVisible();
    await expect(page.getByText(translate(locale, "add.pasteNote"))).toBeVisible();
    await page.getByPlaceholder(translate(locale, "add.pastePlaceholder")).fill("Role: Welder. Salary LKR 90000 monthly. 40 hours per week.");
    await page.getByRole("button", { name: translate(locale, "add.suggest") }).click();
    await expect(page.getByRole("status").filter({ hasText: translate(locale, "add.reviewEvery") })).toBeVisible();
    const terms = page.getByRole("region", { name: translate(locale, "add.termsAria") });
    for (const key of ["add.f.role", "add.f.salary", "add.f.currency", "add.f.startDate", "add.f.hours", "add.f.responsibilities", "add.f.location"] as const) await expect(terms.getByText(translate(locale, key), { exact: false }).first(), `${locale}:${key}`).toBeVisible();
    await expect(terms.getByText(translate(locale, "add.optional", { label: translate(locale, "add.o.benefits") }), { exact: false })).toBeVisible();
    await expect(page.getByText(translate(locale, "add.participants"), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: translate(locale, "add.analyze") })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\badd\.[a-zA-Z.]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${locale} overflow`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`add-offer-${locale}.png`), fullPage: true });
  });
}

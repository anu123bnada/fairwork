import { expect, test, type Page } from "@playwright/test";
import { coverage, translate } from "../../src/i18n";
const id = "40000000-0000-4000-8000-000000000001";
async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/work-records**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/me/employment-history**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
}

test("Settings switches the interface language, persists it across reloads, sets the page language and never overclaims coverage", async ({ page }, testInfo) => {
  await signedIn(page);
  await page.goto("/app/settings");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const select = page.getByLabel("Language");
  await expect(select.locator("option")).toHaveText(["English", "සිංහල (Sinhala)", "தமிழ் (Tamil)", "Deutsch (German) — preview"]);
  await select.selectOption("si");
  await expect(page.getByRole("heading", { name: translate("si", "settings.title") })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("sinhala-settings.png") });
  await expect(page.locator("html")).toHaveAttribute("lang", "si");
  const stats = coverage("si");
  await expect(page.getByRole("note")).toContainText(translate("si", "language.coverageNote", { count: stats.translated }));
  // The note names screens that are still English. tests/unit/localization-coverage.test.ts fails when that list stops being true.
  await page.reload();
  await expect(page.getByRole("heading", { name: translate("si", "settings.title") })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "si");
  // A screen with no translation stays in English instead of showing keys or blanks.
  await page.goto("/app/passport");
  await expect(page.getByRole("link", { name: translate("si", "nav.passport") })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/settings\.|nav\.|\.title/);
  await page.goto("/app/settings");
  await page.getByLabel(translate("si", "settings.language")).selectOption("ta");
  await expect(page.getByRole("heading", { name: translate("ta", "settings.title") })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("tamil-settings.png") });
  await page.getByLabel(translate("ta", "settings.language")).selectOption("en");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
});

test("translated panels use the selected language and keep a working layout on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page);
  await page.goto("/app/settings");
  await page.getByLabel("Language").selectOption("de");
  await page.goto("/app/work-record");
  await expect(page.getByRole("heading", { name: translate("de", "employment.title") })).toBeVisible();
  await expect(page.getByRole("link", { name: translate("de", "nav.record") })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("german-work-record.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("the onboarding language screen offers real languages and applies the choice", async ({ page }) => {
  await page.goto("/intro/language");
  await page.getByRole("button", { name: /Tamil/ }).click();
  await expect(page.getByRole("heading", { name: translate("ta", "language.heading") })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(translate("ta", "language.selected", { language: "தமிழ்" }));
  await expect(page.getByRole("link", { name: translate("ta", "language.continue") })).toHaveAttribute("href", "/welcome");
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("the home dashboard is translated end to end in Sinhala, Tamil and German without overflow on a phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page);
  await page.goto("/app/settings");
  for (const locale of ["si", "ta", "de"] as const) {
    await page.getByLabel(/Language|භාෂාව|மொழி|Sprache/).selectOption(locale);
    await page.goto("/app/home");
    await expect(page.getByRole("heading", { name: translate(locale, "home.greeting", { name: "Synthetic" }) })).toBeVisible();
    for (const key of ["home.workspace", "home.understand", "home.addPrompt", "home.addOffer", "home.passportTitle", "home.hintStrong", "home.discover", "home.guidance"] as const) {
      await expect(page.getByText(translate(locale, key), { exact: false }).first(), `${locale}:${key}`).toBeVisible();
    }
    await expect(page.getByRole("link", { name: translate(locale, "home.notifications") })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/home\.[a-z]+/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${locale} overflow`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`home-${locale}.png`), fullPage: true });
    await page.goto("/app/settings");
  }
});

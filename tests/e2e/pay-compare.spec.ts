import { expect, test, type Page } from "@playwright/test";
import { translate } from "../../src/i18n";

const id = "40000000-0000-4000-8000-000000000001";
async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
}
async function fill(panel: ReturnType<Page["getByRole"]>, offer: "Offer A" | "Offer B", values: { amount: string; currency?: string; period?: string; hours?: string; days?: string }) {
  const group = panel.getByRole("group", { name: offer });
  await group.getByLabel("Amount").fill(values.amount);
  if (values.currency) await group.getByLabel("Currency").selectOption(values.currency);
  if (values.period) await group.getByLabel("Paid per").selectOption(values.period);
  if (values.hours) await group.getByLabel(/^Hours per week/).fill(values.hours);
  if (values.days) await group.getByLabel(/^Working days per week/).fill(values.days);
}

test("pay is normalized to a monthly figure with its assumptions, and offers compare only in one currency or with a sourced rate", async ({ page }) => {
  await signedIn(page);
  await page.goto("/app/home");
  await page.getByText("Compare pay").first().click();
  const panel = page.getByRole("region", { name: "Compare pay" });
  await fill(panel, "Offer A", { amount: "500", period: "hourly" });
  await expect(panel).toContainText("Hourly pay needs the hours worked per week");
  await fill(panel, "Offer A", { amount: "500", period: "hourly", hours: "40" });
  await expect(panel).toContainText("86,666.67"); await expect(panel).toContainText("assumes 52 weeks and 12 months per year; 40 working hours per week");
  await fill(panel, "Offer B", { amount: "100000", period: "monthly" });
  await expect(panel.getByRole("status")).toContainText("Offer B is higher by"); await expect(panel.getByRole("status")).toContainText("13,333.33");
  await panel.getByRole("group", { name: "Offer B" }).getByLabel("Currency").selectOption("EUR");
  await expect(panel).toContainText("does not assume one");
  await expect(panel.getByRole("note").filter({ hasText: "cannot be compared without a dated, sourced exchange rate" })).toBeVisible();
  await panel.getByLabel(/^Exchange rate/).fill("0.003");
  await panel.getByLabel("Rate date").fill("2026-10-20"); await panel.getByLabel("Rate source").fill("Central bank published rate");
  await expect(panel.getByRole("status")).toContainText("LKR/EUR 0.003 as of 2026-10-20 (Central bank published rate)");
  await expect(panel).toContainText("ignores tax, deductions, overtime");
});

test("the pay comparison is translated and holds on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page);
  await page.goto("/app/settings");
  await page.getByLabel("Language").selectOption("si");
  await page.goto("/app/home");
  await page.getByText(translate("si", "pay.title")).first().click();
  const panel = page.getByRole("region", { name: translate("si", "pay.title") });
  await expect(panel).toContainText(translate("si", "pay.intro")); await expect(panel).toContainText(translate("si", "pay.disclaimer"));
  await expect(panel.getByRole("group", { name: translate("si", "pay.offerA") })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

import { expect, test, type Page } from "@playwright/test";
import { assessOfferTerms } from "../../src/features/offer/assessment";
import { translate, type LocaleCode } from "../../src/i18n";

const id = "40000000-0000-4000-8000-000000000001", questionId = "40000000-0000-4000-8000-000000000003";
const terms = { role: "Workshop Assistant", salary: 80000, currency: "LKR", hoursPerWeek: 40, benefits: "Meals provided" };
const hash = "a".repeat(64);
const offer = {
  offerId: id, companyId: id, workerId: id, representativeId: null, requesterId: id, requesterRole: "WORKER", version: 2, termHash: hash, snapshot: terms,
  changes: [{ field: "salary", previous: "75000", current: "80000" }],
  unresolved: [{ id: questionId, field: "startDate", question: "When does the job start?", required: true }, { id: "40000000-0000-4000-8000-000000000004", field: "paymentDate", question: "On which day is pay received?", required: false }],
};
async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer, agreementId: id, confirmation: null, answers: [], canConfirm: false } } }));
  await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId: id, offerVersion: 2, termHash: hash, assessment: assessOfferTerms(terms) } } }));
  await page.route("**/api/v1/offers/analyses**", route => route.fulfill({ json: { data: { offerId: id, items: [] } } }));
}

for (const locale of ["si", "ta", "de"] as LocaleCode[]) {
  test(`the offer check and questions screens are translated in ${locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page);
    await page.goto("/app/settings");
    await page.getByLabel("Language").selectOption(locale);

    await page.goto(`/app/check?offerId=${id}`);
    await expect(page.getByText(translate(locale, "check.someClarify"))).toBeVisible();
    await expect(page.getByText(translate(locale, "check.statedCount", { stated: 3, total: 5, missing: 2 }))).toBeVisible();
    await expect(page.getByText(translate(locale, "check.basis"))).toBeVisible();
    const grid = page.getByLabel(translate(locale, "check.completenessAria"));
    await expect(grid.getByText(translate(locale, "field.salary"), { exact: true })).toBeVisible();
    await expect(grid.getByText(translate(locale, "add.o.benefits"), { exact: true })).toBeVisible();
    await expect(grid.getByText(translate(locale, "check.stated"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(translate(locale, "check.foundFew"))).toBeVisible();
    await expect(page.getByText(translate(locale, "check.changes"))).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(translate(locale, "check.questionsToAsk")) }).last()).toBeVisible(); // the findings overview links to the questions as well
    // The rule analysis still receives English field names, so its findings do not depend on the display language.
    await expect(page.locator("body")).not.toContainText(/\b(?:check|field|add)\.[a-zA-Z.]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${locale} check overflow`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`check-${locale}.png`), fullPage: true });

    await page.goto(`/app/questions?offerId=${id}`);
    await expect(page.getByRole("heading", { name: translate(locale, "ask.title") })).toBeVisible();
    await expect(page.getByText(translate(locale, "ask.subtitle", { version: 2 }))).toBeVisible();
    await expect(page.getByText(translate(locale, "ask.immutable"))).toBeVisible();
    await expect(page.getByPlaceholder(translate(locale, "ask.placeholder")).first()).toBeVisible();
    await expect(page.getByRole("button", { name: translate(locale, "ask.save") }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: translate(locale, "ask.copy") })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(translate(locale, "ask.continue")) })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\b(?:ask|field)\.[a-zA-Z.]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${locale} questions overflow`).toBeLessThanOrEqual(0);
  });
}

for (const locale of ["en", "si"] as LocaleCode[]) {
  test(`the offer check can download a summary of the saved terms (${locale})`, async ({ page }) => {
    await signedIn(page);
    if (locale !== "en") { await page.goto("/app/settings"); await page.getByLabel("Language").selectOption(locale); }
    await page.goto(`/app/check?offerId=${id}`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: translate(locale, "sum.button") }).click()]);
    expect(download.suggestedFilename()).toBe("oryqen-offer-summary-revision-2.md");
    const text = (await import("node:fs")).readFileSync(await download.path(), "utf8");
    expect(text).toContain(translate(locale, "sum.title")); expect(text).toContain("Workshop Assistant"); expect(text).toContain(hash);
    expect(text).toContain(translate(locale, "sum.notAgreement"));
  });
}

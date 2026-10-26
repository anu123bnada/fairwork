import { expect, test } from "@playwright/test";
import { assessOfferTerms } from "../../src/features/offer/assessment";
import { translate } from "../../src/i18n";

// Transport fixtures only. The assessment is computed by the real rule engine; the view must follow the chosen language.
const id = "40000000-0000-4000-8000-000000000001", hash = "a".repeat(64);
const terms = { role: "Workshop Assistant", employer: "Acme Tools", salary: 80000, currency: "LKR", hoursPerWeek: 40, probation: "unpaid trial is required" };
const offer = { offerId: id, companyId: id, workerId: id, representativeId: null, requesterId: id, requesterRole: "WORKER", version: 1, termHash: hash, snapshot: terms, changes: [], unresolved: [] };

for (const locale of ["si", "ta", "de"] as const) {
  test(`the offer check shows the fairness assessment and rule findings in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
    await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
    await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer, agreementId: id, confirmation: null, answers: [], canConfirm: false } } }));
    await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId: id, offerVersion: 1, termHash: hash, assessment: assessOfferTerms(terms) } } }));
    await page.route("**/api/v1/offers/analyses**", route => route.fulfill({ json: { data: { offerId: id, items: [] } } }));
    await page.goto("/app/settings"); await page.getByLabel("Language").selectOption(locale);
    await page.goto(`/app/check?offerId=${id}`);

    const assessment = page.getByRole("region", { name: translate(locale, "as.aria") });
    await expect(assessment).toContainText(translate(locale, "as.employerNote"));
    await expect(assessment).toContainText(translate(locale, "as.meaning"));
    await expect(assessment).toContainText(translate(locale, "as.cat.pay"));
    await assessment.getByText(translate(locale, "as.detailsSummary")).click();
    await expect(assessment).toContainText(translate(locale, "as.i.salary.l"));
    await expect(assessment).toContainText(translate(locale, "as.ex.concern")); // the unpaid-trial concern is explained in the language
    await expect(assessment).toContainText(translate(locale, "as.limitations"));
    await expect(assessment).not.toContainText("Pay transparency");

    const rules = page.getByRole("region", { name: translate(locale, "ra.aria") });
    await expect(rules).toContainText(translate(locale, "ra.intro"));
    await expect(rules).toContainText(translate(locale, "ra.notice"));
    await expect(page.locator("body")).not.toContainText(/\b(?:as|ra)\.[a-zA-Z.-]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

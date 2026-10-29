import { expect, test, type Page } from "@playwright/test";
import { assessOfferTerms } from "../../src/features/offer/assessment";

// Transport fixtures only; the rule findings and the form behaviour are the real code.
const id = "40000000-0000-4000-8000-000000000001", hash = "a".repeat(64);
async function setup(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers/drafts**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers/analyze", route => route.fulfill({ json: { data: { configured: false, provider: null, model: null, noticeVersion: "offer-analysis.v1", processingRegion: null, dataUse: null, policyHash: null, fallbacks: [], availability: [] } } }));
}

test("only the chosen input method is shown, and entered data survives switching method", async ({ page }) => {
  await setup(page);
  await page.goto("/app/add-offer");
  const tabs = page.getByRole("tablist", { name: "Offer input method" });
  await expect(tabs.getByRole("tab")).toHaveText(["Paste text", "Screenshot", "PDF", "Word document", "Enter manually"]);
  await expect(page.getByLabel("Paste offer text")).toBeVisible();
  await expect(page.getByLabel("Offer PDF")).toHaveCount(0);

  await page.getByLabel("Role title", { exact: true }).fill("Picker");
  await page.getByLabel("Paste offer text").fill("Salary: LKR 85000 per month");
  await tabs.getByRole("tab", { name: "PDF" }).click();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await expect(page.getByLabel("Paste offer text")).toHaveCount(0);
  await tabs.getByRole("tab", { name: "Word document" }).click();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await tabs.getByRole("tab", { name: "Enter manually" }).click();
  await expect(page.getByLabel("Paste offer text")).toHaveCount(0);
  await expect(page.getByLabel("Role title", { exact: true })).toHaveValue("Picker");
  await tabs.getByRole("tab", { name: "Paste text" }).click();
  await expect(page.getByLabel("Paste offer text")).toHaveValue("Salary: LKR 85000 per month");
});

test("terms are grouped, every field stays visible and key-term progress follows the entries", async ({ page }) => {
  await setup(page);
  await page.goto("/app/add-offer");
  await page.getByRole("tab", { name: "Enter manually" }).click();
  for (const title of ["Job and employer", "Salary and benefits", "Working hours and location", "Leave and conditions", "Contract terms", "Optional details"]) await expect(page.getByText(title).first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Fees and deposits (optional)", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "0 of 5 key terms filled in" })).toBeVisible();
  await page.getByLabel("Pay amount").fill("85000");
  await page.getByLabel("Currency", { exact: true }).fill("LKR");
  await expect(page.getByRole("status").filter({ hasText: "2 of 5 key terms filled in" })).toBeVisible();
});

test("the check screen counts stated terms, gaps, rule-based risks and questions from the saved revision", async ({ page }) => {
  const terms = { role: "Workshop Assistant", salary: 80000, currency: "LKR", hoursPerWeek: 40, probation: "unpaid trial is required" };
  const unresolved = [{ id: "40000000-0000-4000-8000-0000000000a1", field: "startDate", question: "When does the job start?", required: true }, { id: "40000000-0000-4000-8000-0000000000a2", field: "responsibilities", question: "What will the role involve?", required: true }];
  const offer = { offerId: id, companyId: id, workerId: id, representativeId: null, requesterId: id, requesterRole: "WORKER", version: 1, termHash: hash, snapshot: terms, changes: [], unresolved };
  await setup(page);
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer, agreementId: id, confirmation: null, answers: [], canConfirm: false } } }));
  await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId: id, offerVersion: 1, termHash: hash, assessment: assessOfferTerms(terms) } } }));
  await page.route("**/api/v1/offers/analyses**", route => route.fulfill({ json: { data: { offerId: id, items: [] } } }));
  await page.goto(`/app/check?offerId=${id}`);
  const overview = page.getByRole("region", { name: "What the check found" });
  await expect(overview).toBeVisible();
  await expect(overview.getByRole("link", { name: /^5\s*Clearly stated$/ })).toBeVisible();
  await expect(overview.getByRole("link", { name: /^2\s*Missing$/ })).toBeVisible();
  await expect(overview.getByRole("link", { name: /^[1-9]\d*\s*Possible risks$/ })).toBeVisible();
  await expect(overview).toContainText("No AI was used on this screen");
});

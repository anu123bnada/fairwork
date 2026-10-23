import { expect, test, type Page } from "@playwright/test";

const workerId = "40000000-0000-4000-8000-000000000001";
const companyId = "40000000-0000-4000-8000-000000000002";
const representativeId = "40000000-0000-4000-8000-000000000003";
const offerId = "40000000-0000-4000-8000-000000000004";

async function setup(page: Page, options: { missingSnapshot?: boolean; workerDraft?: boolean } = {}) {
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [{ companyId, name: "Synthetic organization" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  const confirmations: Record<string, unknown>[] = [];
  let savedOffer: Record<string, unknown>;
  let rejectAmendment = false;
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: {
    id: workerId, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [],
  } } }));
  await page.route("**/api/v1/offers", (route) => {
    const body = route.request().postDataJSON();
    if (rejectAmendment) return route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT" } } });
    savedOffer = {
      offerId, companyId, workerId, requesterId: workerId, requesterRole: "WORKER",
      representativeId: options.workerDraft ? null : representativeId,
      version: body.expectedVersion, termHash: "a".repeat(64), changes: [], unresolved: [],
      ...(options.missingSnapshot ? {} : { snapshot: body.terms }),
    };
    return route.fulfill({ json: { data: savedOffer } });
  });
  await page.route("**/api/v1/agreements?*", (route) => route.fulfill({ json: { data: {
    offer: savedOffer, agreementId: savedOffer.version === 1 ? "50000000-0000-4000-8000-000000000001" : "50000000-0000-4000-8000-000000000002",
    confirmation: null, answers: [], canConfirm: !options.workerDraft,
  } } }));
  await page.route("**/api/v1/agreements", (route) => {
    const body = route.request().postDataJSON();
    confirmations.push(body);
    return route.fulfill({ json: { data: {
      agreementId: body.agreementId, offerId, version: body.expectedVersion, confirmedBy: workerId,
      confirmationRole: "WORKER", currentHash: "server-agreement-hash", status: "awaiting_other_party",
    } } });
  });
  await page.goto("/app/add-offer");
  await page.getByRole("tab", { name: "Enter manually" }).click();
  for (const [label, value] of Object.entries({ "Role title": "Picker", "Pay amount": "1200", Currency: "LKR", "Start date": "2026-11-01", "Expected hours per week": "40", Responsibilities: "Pack orders" })) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByLabel("Company organization", { exact: true }).selectOption(companyId);
  await page.getByRole("button", { name: "Analyze offer" }).click();
  await page.getByRole("link", { name: /See ORYQEN Check/ }).click();
  await openAgreement(page);
  return { confirmations, rejectAmendments: () => { rejectAmendment = true; } };
}

async function openAgreement(page: Page) {
  await page.getByRole("link", { name: /Review agreement/ }).click();
  await expect(page.getByRole("heading", { name: "Agreement summary" })).toBeVisible();
}

async function edit(page: Page) {
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/add-offer$/);
  await page.getByRole("tab", { name: "Enter manually" }).click();
  await page.getByLabel("Pay amount").fill("9999");
}

test("agreement shows the saved revision after unsaved and rejected edits", async ({ page }) => {
  const state = await setup(page);
  await edit(page);
  state.rejectAmendments();
  await page.getByRole("button", { name: "Analyze offer" }).click();
  await expect(page.locator(".fw-error[role='alert']")).toBeVisible();
  await page.getByRole("link", { name: "Check", exact: true }).click();
  await openAgreement(page);
  const savedTerms = page.getByRole("region", { name: "Offer terms for agreement" });
  await expect(savedTerms).toContainText("1200");
  await expect(savedTerms).not.toContainText("9999");
  await page.screenshot({ path: "test-results/day3-visual/after/agreement-rejected-edit.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: /Confirm these terms/ }).click();
  await expect(page.getByRole("status")).toContainText("confirmation was recorded");
  expect(state.confirmations[0]?.expectedVersion).toBe(1);
});

test("a saved amendment clears the earlier confirmation and uses a new agreement ID", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: /Confirm these terms/ }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await edit(page);
  await page.getByRole("button", { name: "Analyze offer" }).click();
  await page.getByRole("link", { name: /See ORYQEN Check/ }).click();
  await openAgreement(page);
  await expect(page.getByRole("region", { name: "Offer terms for agreement" })).toContainText("9999");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.screenshot({ path: "test-results/day3-visual/after/agreement-revision-2.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: /Confirm these terms/ }).click();
  await expect(page.getByRole("status")).toBeVisible();
  expect(state.confirmations.map((request) => request.expectedVersion)).toEqual([1, 2]);
  expect(state.confirmations[0]?.agreementId).not.toBe(state.confirmations[1]?.agreementId);
});

test("missing saved terms disables confirmation and refresh fails closed", async ({ page }) => {
  const state = await setup(page, { missingSnapshot: true });
  await expect(page.getByRole("button", { name: /Confirm these terms/ })).toBeDisabled();
  await expect(page.getByText(/Saved terms are unavailable/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("No offer revision is available.")).toBeVisible();
  expect(state.confirmations).toEqual([]);
});

test("worker-created drafts without a designated representative cannot be confirmed", async ({ page }) => {
  const state = await setup(page, { workerDraft: true });
  await expect(page.getByRole("button", { name: /Confirm these terms/ })).toBeDisabled();
  await expect(page.getByText(/no designated employer representative/)).toBeVisible();
  expect(state.confirmations).toEqual([]);
});

import { expect, test, type Page } from "@playwright/test";

// Optional focused reproduction against the existing local dev server; all
// protected responses below are fixtures, never a real-account verification.
if (process.env.ORYQEN_TEST_LOCAL_RUNNING === "1") test.use({ baseURL: "http://127.0.0.1:3100" });
const worker = "40000000-0000-4000-8000-000000000001";
const company = "40000000-0000-4000-8000-000000000002";
const first = "40000000-0000-4000-8000-000000000003";
const second = "40000000-0000-4000-8000-000000000004";

async function setup(page: Page, denySecond = false) {
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [{ companyId: company, name: "Synthetic organization" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: [first, second].map((id, index) => ({ offerId: id, companyId: company, version: 1, role: index ? "Second saved role" : "First saved role", createdAt: "2026-10-18T00:00:00Z", questions: 0 })), nextCursor: null } } }));
  await page.route("**/api/v1/agreements?*", route => {
    const id = new URL(route.request().url()).searchParams.get("offerId");
    if (denySecond && id === second) return route.fulfill({ status: 403, json: { error: { code: "ACTION_FORBIDDEN" } } });
    return route.fulfill({ json: { data: {
      offer: { offerId: id, companyId: company, workerId: worker, representativeId: null, requesterId: worker, requesterRole: "WORKER", version: 1, termHash: "a".repeat(64), snapshot: { role: id === second ? "Second saved role" : "First saved role", salary: id === second ? 2200 : 1100 }, changes: [], unresolved: [] },
      agreementId: "50000000-0000-4000-8000-000000000001", confirmation: null, answers: [], canConfirm: false,
    } } });
  });
  await page.route("**/api/v1/offers", route => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT" } } });
  });
  await page.goto(`/app/agreement?offerId=${first}`);
  await expect(page.getByRole("region", { name: "Offer terms for agreement" })).toContainText("First saved role");
  return writes;
}

test("opening another saved offer through client navigation selects that record, not the prior one", async ({ page }) => {
  await setup(page);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.locator(".fw-list-row").filter({ hasText: "Second saved role" }).getByRole("link", { name: "Open offer" }).click();
  await expect(page).toHaveURL(new RegExp(`offerId=${second}$`));
  const terms = page.getByRole("region", { name: "Offer terms for agreement" });
  await expect(terms).toContainText("Second saved role");
  await expect(terms).not.toContainText("First saved role");
});

test("denied selection clears the previous record rather than showing stale confirmable terms", async ({ page }) => {
  await setup(page, true);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.locator(".fw-list-row").filter({ hasText: "Second saved role" }).getByRole("link", { name: "Open offer" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Offer terms for agreement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Confirm these terms/ })).toHaveCount(0);
});

test("starting a separate offer does not amend the selected persisted record", async ({ page }) => {
  const writes = await setup(page);
  await page.goto("/app/add-offer");
  await page.getByRole("button", { name: "Start a separate offer", exact: true }).click();
  await page.getByRole("tab", { name: "Enter manually" }).click();
  await expect(page.getByLabel("Role title", { exact: true })).toHaveValue("");
  await page.getByLabel("Role title", { exact: true }).fill("A new separate role");
  await page.getByLabel("Company organization", { exact: true }).selectOption(company);
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]!.offerId).not.toBe(first);
  expect(writes[0]!.expectedVersion).toBe(1);
  await page.reload();
  await page.getByRole("tab", { name: "Enter manually" }).click();
  await expect(page.getByLabel("Role title", { exact: true })).toHaveValue("");
});

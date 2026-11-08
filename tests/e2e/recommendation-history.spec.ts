import { expect, test, type Page } from "@playwright/test";

const id = "40000000-0000-4000-8000-000000000001", entryId = "40000000-0000-4000-8000-000000000099";
// Transport fixture only: the database tests and the real-stack harness prove ownership, minimality and the 50-entry cap.
async function setup(page: Page, saved: Record<string, unknown>[], history: Record<string, unknown>[]) {
  let choice = "none";
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/opportunities**", route => {
    if (route.request().method() === "POST") { const body = route.request().postDataJSON(); if (body.operation === "choice") choice = body.choice; return route.fulfill({ json: { data: { saved: true } } }); }
    const preferences = { role: "warehouse", location: "Kandy", workMode: "remote", minimumPay: null, currency: "LKR", payPeriod: "month" };
    return route.fulfill({ json: { data: { preferences, preferenceVersion: 3, nextCursor: null, items: [{ id, companyId: id, companyName: "Synthetic company", version: 1,
      fields: { title: "Synthetic warehouse role", description: "Synthetic fixture only, not a real vacancy.", location: "Colombo", workMode: "onsite", salary: null, currency: "LKR", payPeriod: "month" },
      status: "published", expiresAt: "2027-01-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", choice, canEdit: false, source: "representative_submission", assurance: "demo_provisioned" }] } } });
  });
  await page.route("**/api/v1/opportunities/history", route => {
    if (route.request().method() === "POST") { saved.push(route.request().postDataJSON() as Record<string, unknown>); return route.fulfill({ json: { data: { entryId, replayed: false } } }); }
    return route.fulfill({ json: { data: { items: history } } });
  });
  await page.route("**/api/v1/opportunities/history/remove", route => { history.length = 0; return route.fulfill({ json: { data: { entryId } } }); });
}

test("saving a listing records only criterion outcomes, and the history panel lists and deletes entries", async ({ page }) => {
  const posted: Record<string, unknown>[] = [], history: Record<string, unknown>[] = [];
  await setup(page, posted, history);
  await page.goto("/app/opportunities");
  await page.getByRole("button", { name: "Save listing" }).first().click();
  await expect.poll(() => posted.length).toBe(1);
  const body = posted[0]!;
  expect(Object.keys(body).sort()).toEqual(["companyName", "listingId", "listingTitle", "preferenceVersion", "reasons"]);
  expect(body.preferenceVersion).toBe(3);
  expect(body.reasons).toEqual([{ id: "role", outcome: "matches" }, { id: "location", outcome: "differs" }, { id: "workMode", outcome: "differs" }]);
  // The title and company are kept so the entry is recognisable; the description, location and any pay figure are not.
  expect(JSON.stringify(body)).not.toMatch(/Synthetic fixture only|Colombo|salary/);
  history.push({ entryId, listingId: id, listingTitle: "Synthetic warehouse role", companyName: "Synthetic company", preferenceVersion: 3, reasons: body.reasons, createdAt: "2026-11-05T10:00:00Z" });
  await page.getByText("Saved-listing history", { exact: true }).click();
  const card = page.locator("details", { hasText: "Saved-listing history" }).getByRole("article");
  await expect(card).toContainText("Role: matched");
  await expect(card).toContainText("Location: differed");
  await expect(card).toContainText("Work arrangement: differed");
  await card.getByRole("button", { name: "Delete this entry" }).click();
  await expect(page.getByText("Nothing saved yet. Save a listing and it will appear here.")).toBeVisible();
});

test("a failed history write never blocks saving the listing", async ({ page }) => {
  await setup(page, [], []);
  await page.route("**/api/v1/opportunities/history", route => route.request().method() === "POST" ? route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }) : route.fulfill({ json: { data: { items: [] } } }));
  await page.goto("/app/opportunities");
  await page.getByRole("button", { name: "Save listing" }).first().click();
  await expect(page.getByRole("button", { name: "Remove saved listing" }).first()).toBeVisible();
});

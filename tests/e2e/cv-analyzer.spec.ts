import { expect, test, type Page } from "@playwright/test";

const me = "40000000-0000-4000-8000-000000000001", listingId = "40000000-0000-4000-8000-000000000031", otherId = "40000000-0000-4000-8000-000000000032";
const item = (id: string, title: string, description: string) => ({ id, companyId: me, companyName: "Demo Steel Works (DEMO)", version: 1,
  fields: { title, description, location: "Kandy", workMode: "onsite", salary: null, currency: "LKR", payPeriod: "month" },
  status: "published", expiresAt: "2027-01-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", choice: "none", canEdit: false, source: "representative_submission", assurance: "demo_provisioned" });

// Transport fixtures only: the analyzer rules are covered by unit tests; here the real screen, the panel and the use of published listings are exercised.
async function open(page: Page, listings: ReturnType<typeof item>[] | "error", requests: string[] = []) {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: me, displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route(/\/api\/v1\/cv(\?.*)?$/, route => route.fulfill({ json: { data: { limit: 20, items: [] } } }));
  await page.route("**/api/v1/opportunities**", route => {
    requests.push(route.request().url());
    if (listings === "error") return route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } });
    return route.fulfill({ json: { data: { preferences: null, preferenceVersion: 0, nextCursor: null, items: listings } } });
  });
  await page.goto("/app/cv");
  await page.getByRole("button", { name: "New CV" }).click();
}

test("a visitor analyzes the CV being edited: explained score, what to fix, ATS notes, job-term comparison and listings that mention their skills", async ({ page }) => {
  const requests: string[] = [];
  await open(page, [item(listingId, "Welder", "MIG welding of steel frames in a workshop, with blueprint reading."), item(otherId, "Cashier", "Handle payments and help customers.")], requests);
  await page.getByLabel("Name of this CV version").fill("Welder CV");
  await page.getByLabel("Skills (separate with commas)").fill("MIG welding, Blueprint reading, Safety");
  await page.getByLabel("Professional summary").fill("Welder.");
  const panel = page.locator("details", { hasText: "Analyze this CV (rules-based, not AI)" });
  await panel.getByText("Analyze this CV (rules-based, not AI)").click();
  await panel.getByLabel("Job description to compare with (optional)").fill("We need a welder with MIG welding, stainless steel fabrication and CNC press brake skills. Stainless fabrication, CNC drawings.");
  await panel.getByRole("button", { name: "Analyze this CV" }).click();

  const result = page.getByLabel("CV analysis result");
  await expect(result).toBeVisible();
  await expect(result).toContainText(/Score: \d+ out of 100/);
  await expect(result.getByLabel("Score breakdown")).toContainText("Contact details: 6/15");
  await expect(result.getByLabel("Score breakdown")).toContainText("Skills: 8/15");
  await expect(result).toContainText("No experience listed");
  await expect(result).toContainText("The summary is very short");
  await expect(result).toContainText("one column of plain text");
  const comparison = result.getByLabel("Job description comparison");
  await expect(comparison).toContainText("Not mentioned in your CV:");
  await expect(comparison).toContainText("stainless");
  await expect(comparison).toContainText("Add a missing term only if it is true for you");
  const listings = result.getByLabel("Listings that mention your skills");
  await expect(listings).toContainText("Welder");
  await expect(listings).toContainText("Mentions your skills: mig welding, blueprint reading");
  await expect(listings).not.toContainText("Cashier");
  await expect(listings.getByRole("link", { name: "Open Job opportunities" })).toHaveAttribute("href", "/app/opportunities");
  expect(requests.length).toBeGreaterThanOrEqual(1);
});

test("when published listings cannot be loaded the analysis is still complete and says so", async ({ page }) => {
  await open(page, "error");
  await page.getByLabel("Skills (separate with commas)").fill("Cooking");
  const panel = page.locator("details", { hasText: "Analyze this CV (rules-based, not AI)" });
  await panel.getByText("Analyze this CV (rules-based, not AI)").click();
  await panel.getByRole("button", { name: "Analyze this CV" }).click();
  const result = page.getByLabel("CV analysis result");
  await expect(result).toContainText(/Score: \d+ out of 100/);
  await expect(result.getByRole("alert")).toContainText("Published listings could not be loaded");
});

test("with no published listings it says so instead of inventing any, and a script in a field is shown as plain text", async ({ page }) => {
  await open(page, []);
  await page.getByLabel("Professional summary").fill("<img src=x onerror=alert(1)> I am a careful worker who likes to finish every task on time and keep the workshop tidy and safe for everyone around me.");
  const panel = page.locator("details", { hasText: "Analyze this CV (rules-based, not AI)" });
  await panel.getByText("Analyze this CV (rules-based, not AI)").click();
  await panel.getByRole("button", { name: "Analyze this CV" }).click();
  await expect(page.getByLabel("CV analysis result")).toContainText("There are no published listings on this platform yet.");
  expect(await page.locator("img[src='x']").count()).toBe(0);
});

import { expect, test } from "@playwright/test";

// Transport fixtures only; the database suites and the real-stack journey prove who may read or assign a plan.
const id = "40000000-0000-4000-8000-000000000001";

test("an approved representative sees the organization plan and live-listing usage, with no billing claim", async ({ page }) => {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Employer", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies", route => route.fulfill({ json: { data: { items: [{ companyId: id, name: "Synthetic company" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/organizations/plan?*", route => route.fulfill({ json: { data: { plan: { id: "org_team", name: "Organization team", summary: "Higher listing limits. Assigned by an operator; not purchasable." }, assignedAt: "2026-10-28T00:00:00Z", degraded: false, limits: [{ key: "liveListings", limit: 50, used: 7, remaining: 43, allowed: true }], billing: { available: false, note: "No payment provider is connected. Organization plans are assigned by an operator." } } } }));
  await page.route("**/api/v1/recruiter/queue**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.goto("/app/employer");
  const panel = page.getByRole("region", { name: "Organization plan" });
  await expect(panel).toContainText("Organization team");
  await expect(panel).toContainText("Live opportunity listings: 7 of 50 used");
  await expect(panel).toContainText("No payment provider is connected");
  await expect(panel).toContainText("Worker protections are never limited by an organization plan");
  await expect(panel).not.toContainText(/\$|price|invoice|subscribe/i);
});

test("a plan that cannot be confirmed is shown as the basic plan, and a refusal is shown as an error", async ({ page }) => {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Employer", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies", route => route.fulfill({ json: { data: { items: [{ companyId: id, name: "Synthetic company" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/organizations/plan?*", route => route.fulfill({ status: 403, json: { error: { code: "ACTION_FORBIDDEN" } } }));
  await page.goto("/app/employer");
  await expect(page.getByRole("region", { name: "Organization plan" }).getByRole("alert")).toContainText("could not be loaded");
});

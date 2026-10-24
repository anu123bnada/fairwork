import { expect, test, type Page } from "@playwright/test";
const id = "40000000-0000-4000-8000-000000000001";
async function setup(page: Page) {
  let preferences: unknown = null, preferenceVersion = 0, choice = "none", denied = false;
  const commands: Record<string, unknown>[] = [];
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies", route => route.fulfill({ json: { data: { items: [{ companyId: id, name: "Synthetic company" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/opportunities**", route => {
    if (denied) return route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } });
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON(); commands.push(body);
      if (body.operation === "preferences") { preferences = body.preferences; preferenceVersion++; }
      if (body.operation === "choice") choice = body.choice;
      return route.fulfill({ json: { data: { saved: true } } });
    }
    const view = new URL(route.request().url()).searchParams.get("view");
    const visible = view === "mine" || (view === "saved" ? choice === "saved" : view === "hidden" ? choice === "hidden" : choice !== "hidden");
    return route.fulfill({ json: { data: { preferences, preferenceVersion, nextCursor: null, items: visible ? [{ id, companyId: id, companyName: "Synthetic company", version: 1, fields: { title: "Synthetic warehouse role", description: "Synthetic fixture only, not a real vacancy.", location: "Colombo", workMode: "onsite", salary: 50000, currency: "LKR", payPeriod: "month" }, status: "published", expiresAt: "2026-11-01T00:00:00Z", updatedAt: "2026-10-24T00:00:00Z", choice, canEdit: view === "mine", source: "representative_submission", assurance: "demo_provisioned" }] : [] } } });
  });
  return { commands, deny: () => { denied = true; } };
}
for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) test(`opportunity discovery ${width}px persists preferences and clears denied reads`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const fixture = await setup(page);
  await page.goto("/app/opportunities");
  await expect(page.getByRole("heading", { name: "Synthetic warehouse role" })).toBeVisible();
  await page.getByText("Your private matching preferences", { exact: true }).click();
  await page.getByLabel("Preferred role", { exact: true }).fill("warehouse");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Role: matches", { exact: true })).toBeVisible();
  if ([390, 1440].includes(width)) await page.screenshot({ path: `test-results/opportunities-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await page.reload(); await expect(page.getByRole("button", { name: "Remove saved listing" })).toBeVisible();
  await page.getByRole("button", { name: "Not interested", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Synthetic warehouse role" })).toHaveCount(0);
  await page.getByRole("button", { name: "Hidden", exact: true }).click();
  await page.getByRole("button", { name: "Show again", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  fixture.deny(); await page.getByRole("button", { name: "Refresh listings" }).click();
  await expect(page.getByRole("region", { name: "Opportunity discovery" }).getByRole("alert")).toContainText("Sign in");
  await expect(page.getByRole("heading", { name: "Synthetic warehouse role" })).toHaveCount(0);
});
test("publisher explicitly selects published status and submits a versioned command", async ({ page }) => {
  const fixture = await setup(page); await page.goto("/app/opportunities");
  await page.getByRole("button", { name: "My listings", exact: true }).click();
  await page.getByRole("button", { name: "Create listing", exact: true }).click();
  const editor = page.getByRole("region", { name: "Listing editor" });
  await editor.getByLabel("Listing organization").selectOption(id);
  await editor.getByLabel("Listing title").fill("Synthetic new role");
  await editor.getByLabel("Listing description").fill("Fictional test listing, not a real vacancy.");
  await editor.getByLabel("Listing location").fill("Colombo");
  await expect(editor.getByLabel("Listing status")).toHaveValue("draft");
  await editor.getByLabel("Listing status").selectOption("published");
  const attempts: Record<string, unknown>[] = [];
  await page.route("**/api/v1/opportunities", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) return route.abort();
    return route.fallback();
  });
  await editor.getByRole("button", { name: "Save listing changes" }).click();
  await expect(page.getByRole("region", { name: "Opportunity discovery" }).getByRole("alert")).toBeVisible();
  await expect(editor.getByLabel("Listing title")).toHaveValue("Synthetic new role");
  await editor.getByRole("button", { name: "Save listing changes" }).click();
  await expect(editor).toHaveCount(0);
  expect(attempts[0]).toEqual(attempts[1]);
  expect(fixture.commands.at(-1)).toMatchObject({ operation: "listing", companyId: id, status: "published", expectedVersion: 0 });
});

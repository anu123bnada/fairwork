import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Design-system v2 checks. The API fixtures are transport stand-ins shaped like the real replies (the schemas parse them strictly). They prove that the charts are
// derived from the records and that the phone navigation works; they are not evidence that the hosted service works.
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const offers = [
  { offerId: id(11), companyId: id(21), version: 2, role: "Motorcycle Technician", createdAt: "2026-10-27T09:00:00Z", questions: 3, archived: false, decision: "interested", lifecycleRevision: 1 },
  { offerId: id(12), companyId: id(21), version: 1, role: "Warehouse Assistant", createdAt: "2026-10-20T09:00:00Z", questions: 0, archived: false, decision: "considering", lifecycleRevision: 0 },
  { offerId: id(13), companyId: id(21), version: 1, role: "Delivery Rider", createdAt: "2026-10-12T09:00:00Z", questions: 1, archived: false, decision: "considering", lifecycleRevision: 0 },
];
const records = [
  { workId: id(31), version: 1, state: "verified", hours: "160", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
  { workId: id(32), version: 1, state: "verified", hours: "152", periodStart: "2026-07-01", periodEnd: "2026-07-31" },
  { workId: id(33), version: 1, state: "verified", hours: "120", periodStart: "2026-08-01", periodEnd: "2026-08-31" },
  { workId: id(34), version: 1, state: "submitted", hours: "80", periodStart: "2026-09-01", periodEnd: "2026-09-15" },
  { workId: id(35), version: 1, state: "draft", hours: "64", periodStart: "2026-09-16", periodEnd: "2026-09-30" },
  { workId: id(36), version: 1, state: "withdrawn", hours: "40", periodStart: "2026-09-20", periodEnd: "2026-09-25" },
];
async function signedIn(page: Page, mode: "data" | "empty" | "failed") {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  if (mode === "failed") return;
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: mode === "data" ? offers : [], nextCursor: null } } }));
  await page.route("**/api/v1/work-records", route => route.fulfill({ json: { data: { items: mode === "data" ? records : [], nextCursor: null } } }));
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test("insights are drawn from the person's own records, with a text alternative for every chart", async ({ page }) => {
  test.setTimeout(120_000); // three full-page screenshots (light, dark, tablet) on a loaded machine
  await signedIn(page, "data");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/home");
  const insights = page.getByRole("region", { name: "Your insights" });
  await expect(insights).toBeVisible();

  // Hours chart: confirmed and not-yet-confirmed hours per month. The withdrawn record (40 h) is not counted.
  const hours = insights.getByRole("table", { name: "Hours per month of work period" });
  await expect(hours.getByRole("row", { name: /Jun 26.*160.*0/ })).toBeVisible();
  await expect(hours.getByRole("row", { name: /Jul 26.*152.*0/ })).toBeVisible();
  await expect(hours.getByRole("row", { name: /Aug 26.*120.*0/ })).toBeVisible();
  await expect(hours.getByRole("row", { name: /Sep 26.*0.*144/ })).toBeVisible(); // 80 submitted + 64 draft; 40 withdrawn excluded

  // Offers by decision: 2 considering, 1 interested.
  const decisions = insights.getByRole("table", { name: "Saved offers by the decision you recorded" });
  await expect(decisions.getByRole("row", { name: /Considering.*2/ })).toBeVisible();
  await expect(decisions.getByRole("row", { name: /Interested.*1/ })).toBeVisible();

  // Records by status: 3 confirmed, 1 waiting, 1 draft, 1 withdrawn.
  const states = insights.getByRole("table", { name: "Work records by status" });
  await expect(states.getByRole("row", { name: /Confirmed.*3/ })).toBeVisible();
  await expect(states.getByRole("row", { name: /Waiting for the other side.*1/ })).toBeVisible();
  await expect(states.getByRole("row", { name: /Withdrawn.*1/ })).toBeVisible();

  // The links inside the band go to real screens.
  await expect(insights.getByRole("link", { name: /Open records/ })).toHaveAttribute("href", "/app/work-record");
  await expect(insights.getByRole("link", { name: /Review offers/ })).toHaveAttribute("href", "/app/check");
  await expect(insights.getByRole("link", { name: /Open Passport/ })).toHaveAttribute("href", "/app/passport");

  mkdirSync("test-results/ui-redesign", { recursive: true });
  expect(await noOverflow(page)).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/ui-redesign/home-desktop-light.png", fullPage: true, animations: "disabled" });
  await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/ui-redesign/home-desktop-dark.png", fullPage: true, animations: "disabled" });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1024, height: 800 }); await page.waitForTimeout(400);
  expect(await noOverflow(page)).toBe(true);
  await page.screenshot({ path: "test-results/ui-redesign/home-tablet-1024.png", fullPage: true, animations: "disabled" });
});

test("with nothing saved the band explains what will appear and draws no chart", async ({ page }) => {
  await signedIn(page, "empty");
  await page.goto("/app/home");
  const insights = page.getByRole("region", { name: "Your insights" });
  await expect(insights).toContainText("Your insights start with your first offer or work record");
  await expect(insights).toContainText("no sample numbers are shown here");
  await expect(insights.getByRole("img")).toHaveCount(0);
  await expect(insights.getByRole("link", { name: /first offer/i })).toHaveAttribute("href", "/app/add-offer");
});

test("when both reads fail the band says so instead of showing numbers", async ({ page }) => {
  await signedIn(page, "failed");
  await page.goto("/app/home");
  const insights = page.getByRole("region", { name: "Your insights" });
  await expect(insights).toContainText("Could not be loaded right now.");
  await expect(insights.getByRole("img")).toHaveCount(0);
});

for (const [name, width, height] of [["390", 390, 844], ["375", 375, 812], ["360", 360, 780]] as const) {
  test(`phone ${name}: centre action, menu sheet and swipe rows work without horizontal overflow`, async ({ page }) => {
    await signedIn(page, "data");
    await page.setViewportSize({ width, height });
    await page.goto("/app/home");
    await expect(page.getByRole("region", { name: "Your insights" })).toBeVisible();
    expect(await noOverflow(page), "page overflows horizontally").toBe(true);

    // Centre action: a real link to the add-offer screen with a large touch target.
    const fab = page.getByRole("link", { name: "Add offer", exact: true }).and(page.locator(".fw-nav-fab"));
    await expect(fab).toBeVisible();
    await expect(fab).toHaveAttribute("href", "/app/add-offer");
    const box = (await fab.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(48); expect(box.height).toBeGreaterThanOrEqual(48);
    for (const link of await page.locator(".fw-bottom-nav .fw-nav-link").all()) { const b = (await link.boundingBox())!; expect(b.height, "nav touch target").toBeGreaterThanOrEqual(44); }

    // Menu sheet: opens from the header, lists every grouped screen, closes with Escape and returns focus.
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await menu.click();
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(sheet).toBeVisible();
    for (const label of ["Job opportunities", "Application tracker", "CV Builder", "Salary comparison", "Concerns and cases", "Settings"]) await expect(sheet.getByRole("link", { name: new RegExp(`^${label}`) }).first()).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    if (name === "390") { mkdirSync("test-results/ui-redesign", { recursive: true }); await page.screenshot({ path: "test-results/ui-redesign/menu-sheet-390.png", animations: "disabled" }); }
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(menu).toBeFocused();

    // A link in the sheet navigates and closes it.
    await menu.click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: /^Job opportunities/ }).click();
    await expect(page).toHaveURL(/\/app\/opportunities/);
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);

    await page.goto("/app/home");
    await page.waitForTimeout(600);
    if (name === "390") await page.screenshot({ path: "test-results/ui-redesign/home-mobile-390.png", fullPage: true, animations: "disabled" });
    if (name === "390") {
      await page.screenshot({ path: "test-results/ui-redesign/home-mobile-390-top.png", animations: "disabled" });
      await page.getByRole("region", { name: "Your insights" }).scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
      await page.screenshot({ path: "test-results/ui-redesign/home-mobile-390-insights.png", animations: "disabled" });
    }
    expect(await noOverflow(page)).toBe(true);
  });
}

import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// The dashboard is built from the person's own records. These fixtures are transport stand-ins shaped like the real API replies (the schemas parse them strictly), used to check
// that the summary cards, journey and recent offers are derived from the data and that the composition holds; they are not evidence that the hosted service works.
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const offers = [
  { offerId: id(11), companyId: id(21), version: 2, role: "Motorcycle Technician", createdAt: "2026-10-27T09:00:00Z", questions: 3, archived: false, decision: "interested", lifecycleRevision: 1 },
  { offerId: id(12), companyId: id(21), version: 1, role: "Warehouse Assistant", createdAt: "2026-10-20T09:00:00Z", questions: 0, archived: false, decision: "considering", lifecycleRevision: 0 },
];
const records = [
  { workId: id(31), version: 1, state: "verified", hours: "160", periodStart: "2026-08-01", periodEnd: "2026-08-31" },
  { workId: id(32), version: 1, state: "draft", hours: "80", periodStart: "2026-09-01", periodEnd: "2026-09-15" },
];
async function signedIn(page: Page, withData: boolean) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: withData ? offers : [], nextCursor: null } } }));
  await page.route("**/api/v1/work-records", route => route.fulfill({ json: { data: { items: withData ? records : [], nextCursor: null } } }));
}

test("dashboard summary, journey and recent offers are derived from the person's records", async ({ page }) => {
  await signedIn(page, true);
  await page.goto("/app/home");
  const offersCard = page.getByRole("region", { name: "Saved offers", exact: true }).first();
  await expect(page.getByRole("region", { name: "Welcome and next step" })).toContainText("Good morning, Synthetic"); await expect(page.getByRole("region", { name: "Welcome and next step" })).toContainText("You have 2 saved offer(s) and 3 question(s) worth asking");
  await expect(page.locator(".fw-sum-card").filter({ hasText: "Saved offers" })).toContainText("2");
  await expect(page.locator(".fw-sum-card").filter({ hasText: "Saved offers" })).toContainText("3 question(s) to ask");
  await expect(page.locator(".fw-sum-card").filter({ hasText: "Work records" })).toContainText("1 confirmed by the other side");
  await expect(page.locator(".fw-sum-card").filter({ hasText: "Work Passport" })).toContainText("1 confirmed record(s) in your Passport");
  const recent = page.getByRole("region", { name: "Recent offers" });
  await expect(recent).toContainText("Motorcycle Technician"); await expect(recent).toContainText("Warehouse Assistant"); await expect(recent).toContainText("No open questions");
  await expect(recent.getByRole("link", { name: "Review offer: Motorcycle Technician" })).toHaveAttribute("href", `/app/agreement?offerId=${id(11)}`);
  const journey = page.getByRole("list", { name: "Your employment journey" });
  await expect(journey.locator("li.is-done")).toHaveCount(3); // offer, record and passport are proven by the data
  await expect(journey.locator("li.is-current")).toContainText("Findings");
  await expect(offersCard).toBeVisible();
  for (const [name, w, h, scheme] of [["desktop-light", 1440, 900, "light"], ["mobile-light", 390, 844, "light"], ["desktop-dark", 1440, 900, "dark"], ["mobile-dark", 390, 844, "dark"]] as const) {
    mkdirSync("test-results/dashboard", { recursive: true });
    await page.setViewportSize({ width: w, height: h }); await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflows`).toBe(true);
    await page.screenshot({ path: `test-results/dashboard/${name}.png`, fullPage: false, animations: "disabled" });
  }
});

test("with no records the dashboard keeps its composition and guides the person into the first offer", async ({ page }) => {
  await signedIn(page, false);
  await page.goto("/app/home");
  await expect(page.locator(".fw-sum-card").filter({ hasText: "Saved offers" })).toContainText("Nothing saved yet");
  await expect(page.getByRole("region", { name: "Recent offers" })).toContainText("Your first offer starts here");
  await expect(page.getByRole("list", { name: "Your employment journey" }).locator("li.is-current")).toContainText("Your offer");
  await expect(page.getByRole("region", { name: "Welcome and next step" }).getByRole("link", { name: /Add offer/ }).first()).toHaveAttribute("href", "/app/add-offer");
});

test("a failed read says so on the card instead of showing a number", async ({ page }) => {
  await signedIn(page, true);
  await page.route("**/api/v1/work-records", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.goto("/app/home");
  await expect(page.locator(".fw-sum-card").filter({ hasText: "Work records" })).toContainText("Could not be loaded right now.");
});

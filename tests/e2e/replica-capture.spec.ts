import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Design-replication captures. API replies are transport stand-ins shaped like the real ones (the app's schemas parse them strictly); they show layout and rendering of real
// fields only. Output folder is chosen with REPLICA_SET (before | after).
const set = process.env.REPLICA_SET ?? "after";
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const offers = [
  { offerId: id(11), companyId: id(21), version: 2, role: "Motorcycle Technician", createdAt: "2026-10-27T09:00:00Z", questions: 3, archived: false, decision: "interested", lifecycleRevision: 1 },
  { offerId: id(12), companyId: id(21), version: 1, role: "Warehouse Assistant", createdAt: "2026-10-20T09:00:00Z", questions: 0, archived: false, decision: "considering", lifecycleRevision: 0 },
  { offerId: id(13), companyId: id(22), version: 1, role: "Delivery Rider", createdAt: "2026-10-12T09:00:00Z", questions: 1, archived: false, decision: "considering", lifecycleRevision: 0 },
];
const records = [
  { workId: id(31), version: 1, state: "verified", hours: "160", periodStart: "2026-08-01", periodEnd: "2026-08-31" },
  { workId: id(33), version: 1, state: "verified", hours: "420", periodStart: "2026-03-01", periodEnd: "2026-05-31" },
  { workId: id(32), version: 1, state: "submitted", hours: "80", periodStart: "2026-09-01", periodEnd: "2026-09-15" },
  { workId: id(34), version: 1, state: "draft", hours: "64", periodStart: "2026-09-16", periodEnd: "2026-09-30" },
];
async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: offers, nextCursor: null } } }));
  await page.route("**/api/v1/work-records", route => route.fulfill({ json: { data: { items: records, nextCursor: null } } }));
}
const sizes = [["1440", 1440, 900], ["1280", 1280, 800], ["1024", 1024, 768], ["390", 390, 844], ["375", 375, 812], ["360", 360, 780]] as const;
for (const [label, width, height] of sizes) {
  test(`dashboard ${label}`, async ({ page }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/app/home");
    await page.locator(".fw-dash").waitFor();
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(`overflow ${label}: ${overflow}`);
    mkdirSync(`test-results/replica/${set}`, { recursive: true });
    await page.screenshot({ path: `test-results/replica/${set}/dashboard-${label}.png`, fullPage: false, animations: "disabled" });
    await page.screenshot({ path: `test-results/replica/${set}/dashboard-${label}-full.png`, fullPage: true, animations: "disabled" });
  });
}

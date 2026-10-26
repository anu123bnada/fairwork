import { expect, test, type Page } from "@playwright/test";
import { assessOfferTerms } from "../../src/features/offer/assessment";

// Route acceptance matrix. Every page the application serves is opened at phone and desktop width, signed out and (for /app screens)
// signed in with synthetic transport fixtures. For each load it asserts: the page renders content, nothing throws in the page, no
// hydration problem is logged, there is no horizontal overflow, and signed-out visitors cannot see private screens. Data behaviour is
// covered by the journey specs, the real-stack harness and the database suites; this matrix guards route coverage and fail-closed access.
const id = "40000000-0000-4000-8000-000000000001", hash = "a".repeat(64);
const terms = { role: "Workshop Assistant", employer: "Acme Tools", salary: 80000, currency: "LKR", hoursPerWeek: 40 };
const offer = { offerId: id, companyId: id, workerId: id, representativeId: null, requesterId: id, requesterRole: "WORKER", version: 1, termHash: hash, snapshot: terms, changes: [], unresolved: [] };

const publicRoutes = ["/", "/about", "/downloads", "/sign-in", "/sign-in/information", "/register", "/forgot-password", "/verify", "/welcome", "/otp", "/auth/confirm", "/auth/recover", "/intro/language"];
const appScreens = ["home", "opportunities", "guidance", "add-offer", "check", "questions", "agreement", "agreement-workflow", "work-record", "cases", "passport", "settings", "employer", "notifications", "share", "intro-welcome"];

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", error => problems.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    const text = message.text();
    if (message.type() !== "error") return;
    // Failed fixture requests are logged by the browser itself; they are not application errors.
    if (/Failed to load resource|ERR_|status of 40[134]|status of 503/.test(text)) return;
    problems.push(`console: ${text.slice(0, 200)}`);
  });
  return problems;
}
async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer, agreementId: id, confirmation: null, answers: [], canConfirm: false } } }));
  await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId: id, offerVersion: 1, termHash: hash, assessment: assessOfferTerms(terms) } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers/drafts", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
}
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [label, size] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 800 }]] as const) {
  test.describe(label, () => {
    test.use({ viewport: size });

    for (const route of publicRoutes) {
      test(`public ${route} renders without errors or overflow (${label})`, async ({ page }) => {
        const problems = watch(page);
        await page.route("**/api/v1/**", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
        const response = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(response?.status(), route).toBeLessThan(500);
        await page.waitForTimeout(500);
        expect((await page.locator("body").innerText()).trim().length, `${route} is blank`).toBeGreaterThan(20);
        expect(await overflow(page), `${route} overflows`).toBeLessThanOrEqual(0);
        expect(problems, route).toEqual([]);
      });
    }

    for (const screen of appScreens) {
      test(`signed-in /app/${screen} renders without errors or overflow (${label})`, async ({ page }) => {
        const problems = watch(page);
        await signedIn(page);
        await page.goto(`/app/${screen}?offerId=${id}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(900);
        expect((await page.locator("body").innerText()).trim().length, `${screen} is blank`).toBeGreaterThan(20);
        expect(await overflow(page), `${screen} overflows`).toBeLessThanOrEqual(0);
        expect(problems, screen).toEqual([]);
      });
    }
  });
}

test.describe("signed-out visitors cannot see private screens", () => {
  for (const screen of appScreens.filter(name => name !== "intro-welcome")) {
    test(`/app/${screen} fails closed`, async ({ page }) => {
      await page.route("**/api/v1/**", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
      await page.goto(`/app/${screen}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      // Either redirected to sign-in or shown no private content: no account data may appear.
      const text = await page.locator("body").innerText();
      expect(text).not.toContain("Synthetic Worker");
      expect(text).not.toMatch(/Saved offers|Work Passport\s*\n.*Verified/);
    });
  }
  test("the admin console and operator screens require sign-in", async ({ page }) => {
    await page.route("**/api/v1/**", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
    for (const path of ["/admin", "/admin/cases", "/operator/authority"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const url = page.url(), text = await page.locator("body").innerText();
      expect(/sign-in/.test(url) || /sign in|authorization|not available|required/i.test(text), `${path} did not fail closed (${url})`).toBe(true);
    }
  });
});

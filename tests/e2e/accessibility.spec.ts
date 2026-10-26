import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { assessOfferTerms } from "../../src/features/offer/assessment";

// Automated WCAG 2.1 A/AA rule checks (axe-core) on the main screens, with synthetic transport fixtures. This finds a class of
// problems (names, labels, roles, contrast of text we render); it does not replace a manual screen-reader and keyboard review.
const id = "40000000-0000-4000-8000-000000000001", hash = "a".repeat(64);
const terms = { role: "Workshop Assistant", employer: "Acme Tools", salary: 80000, currency: "LKR", hoursPerWeek: 40 };
const offer = { offerId: id, companyId: id, workerId: id, representativeId: null, requesterId: id, requesterRole: "WORKER", version: 1, termHash: hash, snapshot: terms, changes: [], unresolved: [] };

async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer, agreementId: id, confirmation: null, answers: [], canConfirm: false } } }));
  await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId: id, offerVersion: 1, termHash: hash, assessment: assessOfferTerms(terms) } } }));
  await page.route("**/api/v1/offers/analyses**", route => route.fulfill({ json: { data: { offerId: id, items: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers/drafts", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
}

const screens: [string, string][] = [
  ["home", "/app/home"], ["add offer", "/app/add-offer"], ["offer check", `/app/check?offerId=${id}`], ["settings", "/app/settings"],
  ["landing", "/"], ["sign in", "/sign-in"], ["register", "/register"], ["credential verification", "/verify"], ["about", "/about"], ["agreement lookup", "/app/agreement-workflow"], ["questions", `/app/questions?offerId=${id}`],
  ["employer workspace", "/app/employer"], ["work record", "/app/work-record"], ["passport", "/app/passport"], ["cases", "/app/cases"],
];

for (const scheme of ["light", "dark"] as const) {
  for (const [name, path] of screens) {
    test(`no serious or critical accessibility violations on ${name} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await signedIn(page);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load").catch(() => undefined);
      await page.waitForTimeout(800);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = result.violations.filter(violation => violation.impact === "serious" || violation.impact === "critical");
      expect(serious.map(violation => `${violation.id}: ${violation.nodes.slice(0, 3).map(node => node.target.join(" ") + " " + (node.any[0]?.message ?? "")).join(" | ")}`), `${name} ${scheme}`).toEqual([]);
    });
  }
}

import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { assessOfferTerms } from "../../src/features/offer/assessment";

// Responsive QA matrix: the five priority screens at 1440, 1280, 390, 375 and 360 px, with fixture data. Every cell checks for horizontal overflow, blocking console errors
// and a visible main landmark, and captures a screenshot. The API replies are transport stand-ins shaped like the real ones (the schemas parse them strictly). They prove layout
// and rendering of real fields; they are not evidence that the hosted service works.
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-10-14T01:00:00Z", hash = "a".repeat(64);
const SHA = "ab".repeat(32);
const offers = [
  { offerId: id(11), companyId: id(21), version: 2, role: "Motorcycle Technician", createdAt: "2026-10-27T09:00:00Z", questions: 3, archived: false, decision: "interested", lifecycleRevision: 1 },
  { offerId: id(12), companyId: id(21), version: 1, role: "Warehouse Assistant", createdAt: "2026-10-20T09:00:00Z", questions: 0, archived: false, decision: "considering", lifecycleRevision: 0 },
  { offerId: id(13), companyId: id(21), version: 1, role: "Delivery Rider", createdAt: "2026-10-12T09:00:00Z", questions: 1, archived: false, decision: "considering", lifecycleRevision: 0 },
];
const records = [
  { workId: id(31), version: 1, state: "verified", hours: "160", periodStart: "2026-06-01", periodEnd: "2026-06-30" },
  { workId: id(32), version: 1, state: "verified", hours: "152", periodStart: "2026-07-01", periodEnd: "2026-07-31" },
  { workId: id(34), version: 1, state: "submitted", hours: "80", periodStart: "2026-09-01", periodEnd: "2026-09-15" },
  { workId: id(35), version: 1, state: "draft", hours: "64", periodStart: "2026-09-16", periodEnd: "2026-09-30" },
];
const entry = (n: number, role: string, company: string, start: string, end: string, hours: string, tasks: string, evidence: number) => ({
  workId: id(n), version: 1, role, periodStart: start, periodEnd: end, hours, summary: tasks, companyId: id(50), companyName: company, agreementId: id(60 + n), agreementVersion: 1,
  agreementHash: hash, agreementEffectiveAt: time, verificationId: id(70 + n), verifiedAt: "2026-10-20T09:00:00Z", verifierId: id(80), authorityDecisionId: id(90 + n), evidenceCount: evidence, evidenceHash: "b".repeat(64),
});
const passportEntries = [
  entry(1, "Motorcycle Technician", "AutoCare Garage", "2026-06-01", "2026-06-30", "160", "Servicing, brake and chain work on customer motorcycles.", 3),
  entry(2, "Warehouse Assistant", "Harbour Logistics", "2026-03-01", "2026-05-31", "420", "Stock counts, picking, and dispatch preparation.", 2),
  entry(3, "Delivery Rider", "QuickDrop Ltd", "2025-11-01", "2026-01-31", "310", "Route deliveries with proof-of-delivery photos.", 1),
];
const doc = (n: number, title: string, category: string, file: string, size: number) => ({ documentId: id(n), title, category, fileName: file, mediaType: "application/pdf", byteSize: size, sha256: SHA, createdAt: "2026-10-27T08:00:00Z" });
const terms = { role: "Workshop Assistant", salary: 80000, currency: "LKR", payPeriod: "monthly", hoursPerWeek: 60, probation: "Unpaid trial is required", noticeDays: 0, overtime: "Overtime is not paid" };
const offerFixture = { offerId: id(1), companyId: id(21), workerId: id(1), representativeId: null, requesterId: id(1), requesterRole: "WORKER", version: 2, termHash: hash, snapshot: terms, changes: [], unresolved: [] };

async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: offers, nextCursor: null } } }));
  await page.route("**/api/v1/work-records**", route => route.fulfill({ json: { data: { items: records, nextCursor: null } } }));
  await page.route("**/api/v1/passport**", route => route.fulfill({ json: { data: { policyVersion: "private-work-passport.v1", passportId: id(2), ownerId: id(1), createdAt: time, entries: passportEntries, nextCursor: null } } }));
  await page.route("**/api/v1/me/employment-history**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/companies", route => route.fulfill({ json: { data: { items: [{ companyId: id(21), name: "AutoCare Garage" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/vault", route => route.fulfill({ json: { data: { items: [doc(10, "Welding certificate", "certificate", "welding-certificate.pdf", 184320), doc(11, "Employer reference letter", "letter", "reference-letter.pdf", 92160), doc(12, "October payslip", "payslip", "payslip-oct.pdf", 61440)], limit: 50, used: 3, storageConfigured: true } } }));
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer: offerFixture, agreementId: id(1), confirmation: null, answers: [], canConfirm: false } } }));
  await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId: id(1), offerVersion: 2, termHash: hash, assessment: assessOfferTerms(terms as never) } } }));
  await page.route("**/api/v1/applications?view=dashboard", route => route.fulfill({ json: { data: { items: [
    { listingId: id(41), title: "Motorcycle Technician", status: "published", expiresAt: "2026-12-01T00:00:00Z", counts: { submitted: 3, reviewing: 2, shortlisted: 1, declined: 1, withdrawn: 0 } },
    { listingId: id(42), title: "Warehouse Assistant", status: "published", expiresAt: "2026-12-15T00:00:00Z", counts: { submitted: 1, reviewing: 0, shortlisted: 0, declined: 0, withdrawn: 0 } },
    { listingId: id(43), title: "Delivery Rider", status: "closed", expiresAt: "2026-10-01T00:00:00Z", counts: { submitted: 0, reviewing: 0, shortlisted: 0, declined: 2, withdrawn: 1 } },
  ], limit: 100 } } }));
  await page.route("**/api/v1/organizations", route => route.fulfill({ json: { data: { items: [{ requestId: id(51), companyId: id(21), companyName: "AutoCare Garage", statement: "I manage hiring at this garage.", createdAt: "2026-10-10T08:00:00Z", decision: "approve", reason: "Authority reviewed against the registration record.", active: true }], nextCursor: null } } }));
}

const widths = [["1440", 1440, 900], ["1280", 1280, 800], ["390", 390, 844], ["375", 375, 812], ["360", 360, 780]] as const;
const screens = [
  ["dashboard", "/app/home", "Work hours by month"],
  ["check", `/app/check?offerId=${id(1)}`, "Offer fairness indicators"],
  ["vault", "/app/work-record", "Evidence Vault"],
  ["passport", "/app/passport", "Verified work history"],
  ["employer", "/app/employer", "Applications received"],
] as const;

for (const [screen, path, anchor] of screens) {
  for (const [label, width, height] of widths) {
    test(`${screen} at ${label}px: no overflow, no blocking console errors, captured`, async ({ page }) => {
      test.setTimeout(120_000);
      const consoleErrors: string[] = [];
      page.on("console", message => { if (message.type() === "error" && !/Failed to load resource|503|net::ERR/.test(message.text())) consoleErrors.push(message.text()); });
      page.on("pageerror", error => consoleErrors.push(`pageerror: ${error.message}`));
      await signedIn(page);
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await expect(page.getByText(anchor, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForTimeout(700);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${screen} ${label}: horizontal overflow`).toBe(true);
      // Full-page captures render position:fixed bars at the viewport position, over the content. Make them static for the capture only.
      await page.addStyleTag({ content: ".fw-fixed-action, .fw-demo-passport-action, .fw-nav-fab, .fw-bottom-nav { position: static !important; } .fw-product-body { padding-bottom: 24px !important; }" });
      mkdirSync("test-results/ui-qa", { recursive: true });
      await page.screenshot({ path: `test-results/ui-qa/${screen}-${label}.png`, fullPage: true, animations: "disabled" });
      expect(consoleErrors, `${screen} ${label}: console errors`).toEqual([]);
    });
  }
}

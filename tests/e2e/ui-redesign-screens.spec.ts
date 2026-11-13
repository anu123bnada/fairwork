import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { assessOfferTerms } from "../../src/features/offer/assessment";

// Priority screens with fixture data, captured at desktop and phone widths and checked for overflow and real content. The API fixtures are transport stand-ins shaped like
// the real replies (the schemas parse them strictly); they prove layout and rendering of real fields, not that the hosted service works.
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = "a".repeat(64), time = "2026-10-14T01:00:00Z";
const entry = (n: number, role: string, company: string, start: string, end: string, hours: string, tasks: string, evidence: number) => ({
  workId: id(n), version: 1, role, periodStart: start, periodEnd: end, hours, summary: tasks, companyId: id(50), companyName: company, agreementId: id(60 + n), agreementVersion: 1,
  agreementHash: hash, agreementEffectiveAt: time, verificationId: id(70 + n), verifiedAt: "2026-10-20T09:00:00Z", verifierId: id(80), authorityDecisionId: id(90 + n), evidenceCount: evidence, evidenceHash: "b".repeat(64),
});
const passportEntries = [
  entry(1, "Motorcycle Technician", "AutoCare Garage", "2026-08-01", "2026-08-31", "160", "Servicing, brake and chain work on customer motorcycles.", 3),
  entry(2, "Warehouse Assistant", "Harbour Logistics", "2026-03-01", "2026-05-31", "420", "Stock counts, picking, and dispatch preparation.", 2),
  entry(3, "Delivery Rider", "QuickDrop Ltd", "2025-11-01", "2026-01-31", "310", "Route deliveries with proof-of-delivery photos.", 1),
];
const SHA = "ab".repeat(32);
const doc = (n: number, title: string, category: string, file: string, size: number) => ({ documentId: id(n), title, category, fileName: file, mediaType: "application/pdf", byteSize: size, sha256: SHA, createdAt: "2026-10-27T08:00:00Z" });
const records = [
  { workId: id(1), version: 1, state: "verified", hours: "160", periodStart: "2026-08-01", periodEnd: "2026-08-31" },
  { workId: id(2), version: 1, state: "verified", hours: "420", periodStart: "2026-03-01", periodEnd: "2026-05-31" },
  { workId: id(4), version: 1, state: "submitted", hours: "80", periodStart: "2026-09-01", periodEnd: "2026-09-15" },
  { workId: id(5), version: 1, state: "draft", hours: "64", periodStart: "2026-09-16", periodEnd: "2026-09-30" },
];

async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/passport**", route => route.fulfill({ json: { data: { policyVersion: "private-work-passport.v1", passportId: id(2), ownerId: id(1), createdAt: time, entries: passportEntries, nextCursor: null } } }));
  await page.route("**/api/v1/work-records**", route => route.fulfill({ json: { data: { items: records, nextCursor: null } } }));
  await page.route("**/api/v1/me/employment-history**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/vault", route => route.fulfill({ json: { data: { items: [doc(10, "Welding certificate", "certificate", "welding-certificate.pdf", 184320), doc(11, "Employer reference letter", "letter", "reference-letter.pdf", 92160), doc(12, "October payslip", "payslip", "payslip-oct.pdf", 61440)], limit: 50, used: 3, storageConfigured: true } } }));
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
  test(`Work Passport with verified entries, ${label}`, async ({ page }) => {
    test.setTimeout(90_000);
    await signedIn(page);
    await page.setViewportSize({ width, height });
    await page.goto("/app/passport");
    const hero = page.getByRole("region", { name: "Work Passport" });
    await expect(hero).toContainText("Nimal Perera");
    await expect(page.getByText("Motorcycle Technician")).toBeVisible();
    await expect(page.getByText("Harbour Logistics")).toBeVisible();
    expect(await noOverflow(page), `${label} overflows`).toBe(true);
    mkdirSync("test-results/ui-redesign", { recursive: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/ui-redesign/passport-${label}.png`, fullPage: true, animations: "disabled" });
  });
  test(`Work record and Evidence Vault with records and documents, ${label}`, async ({ page }) => {
    test.setTimeout(90_000);
    await signedIn(page);
    await page.setViewportSize({ width, height });
    await page.goto("/app/work-record");
    await expect(page.getByText("Welding certificate")).toBeVisible();
    expect(await noOverflow(page), `${label} overflows`).toBe(true);
    mkdirSync("test-results/ui-redesign", { recursive: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/ui-redesign/work-record-${label}.png`, fullPage: true, animations: "disabled" });
  });
}

// Check screen with the real rule-based assessment engine run on a realistic offer (the engine output is genuine; only the transport is stubbed).
const offerId = id(1);
const terms = { role: "Workshop Assistant", salary: 80000, currency: "LKR", payPeriod: "monthly", hoursPerWeek: 60, probation: "Unpaid trial is required", noticeDays: 0, overtime: "Overtime is not paid" };
const offerFixture = { offerId, companyId: offerId, workerId: offerId, representativeId: null, requesterId: offerId, requesterRole: "WORKER", version: 2, termHash: "a".repeat(64), snapshot: terms, changes: [], unresolved: [] };
for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
  test(`ORYQEN Check with real assessment findings, ${label}`, async ({ page }) => {
    test.setTimeout(90_000);
    await signedIn(page);
    await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer: offerFixture, agreementId: offerId, confirmation: null, answers: [], canConfirm: false } } }));
    await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId, offerVersion: 2, termHash: offerFixture.termHash, assessment: assessOfferTerms(terms as never) } } }));
    await page.setViewportSize({ width, height });
    await page.goto(`/app/check?offerId=${offerId}`);
    const panel = page.getByRole("region", { name: "Offer fairness indicators" });
    await expect(panel).toBeVisible();
    expect(await noOverflow(page), `${label} overflows`).toBe(true);
    mkdirSync("test-results/ui-redesign", { recursive: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/ui-redesign/check-${label}.png`, fullPage: true, animations: "disabled" });
  });
}

import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { assessOfferTerms } from "../../src/features/offer/assessment";

// Design-replication captures of the priority screens. API replies are transport stand-ins shaped like the real ones (the app schemas parse them strictly);
// they show layout of real fields only. Output folder: REPLICA_SET (before | after).
const set = process.env.REPLICA_SET ?? "after";
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = "a".repeat(64), time = "2026-10-14T01:00:00Z", SHA = "ab".repeat(32);
const entry = (n: number, role: string, company: string, start: string, end: string, hours: string, tasks: string, evidence: number) => ({
  workId: id(n), version: 1, role, periodStart: start, periodEnd: end, hours, summary: tasks, companyId: id(50), companyName: company, agreementId: id(60 + n), agreementVersion: 1,
  agreementHash: hash, agreementEffectiveAt: time, verificationId: id(70 + n), verifiedAt: "2026-10-20T09:00:00Z", verifierId: id(80), authorityDecisionId: id(90 + n), evidenceCount: evidence, evidenceHash: "b".repeat(64),
});
const passportEntries = [
  entry(1, "Motorcycle Technician", "AutoCare Garage", "2026-08-01", "2026-08-31", "160", "Servicing, brake and chain work.", 3),
  entry(2, "Warehouse Assistant", "Harbour Logistics", "2026-03-01", "2026-05-31", "420", "Stock counts, picking, dispatch.", 2),
];
const doc = (n: number, title: string, category: string, file: string, size: number) => ({ documentId: id(n), title, category, fileName: file, mediaType: "application/pdf", byteSize: size, sha256: SHA, createdAt: "2026-10-27T08:00:00Z" });
const records = [
  { workId: id(1), version: 1, state: "verified", hours: "160", periodStart: "2026-08-01", periodEnd: "2026-08-31" },
  { workId: id(2), version: 1, state: "verified", hours: "420", periodStart: "2026-03-01", periodEnd: "2026-05-31" },
  { workId: id(4), version: 1, state: "submitted", hours: "80", periodStart: "2026-09-01", periodEnd: "2026-09-15" },
  { workId: id(5), version: 1, state: "draft", hours: "64", periodStart: "2026-09-16", periodEnd: "2026-09-30" },
];
const offers = [
  { offerId: id(11), companyId: id(21), version: 2, role: "Motorcycle Technician", createdAt: "2026-10-27T09:00:00Z", questions: 3, archived: false, decision: "interested", lifecycleRevision: 1 },
  { offerId: id(12), companyId: id(21), version: 1, role: "Warehouse Assistant", createdAt: "2026-10-20T09:00:00Z", questions: 0, archived: false, decision: "considering", lifecycleRevision: 0 },
];
const listing = (n: number, title: string, company: string, location: string, mode: "onsite" | "hybrid" | "remote", salary: number, choice: "saved" | "none") => ({
  id: id(100 + n), companyId: id(50 + n), companyName: company, version: 1, fields: { title, description: "Responsibilities, hours and pay are stated by the representative.", location, workMode: mode, salary, currency: "LKR", payPeriod: "month" },
  status: "published", expiresAt: "2026-12-31T00:00:00Z", updatedAt: "2026-10-30T00:00:00Z", choice, canEdit: false, source: "representative_submission", assurance: "demo_provisioned",
});
const offerId = id(1);
const terms = { role: "Workshop Assistant", salary: 80000, currency: "LKR", payPeriod: "monthly", hoursPerWeek: 60, probation: "Unpaid trial is required", noticeDays: 0, overtime: "Overtime is not paid" };
const offerFixture = { offerId, companyId: offerId, workerId: offerId, representativeId: null, requesterId: offerId, requesterRole: "WORKER", version: 2, termHash: hash, snapshot: terms, changes: [], unresolved: [] };

async function signedIn(page: Page) {
  const ok = (data: unknown) => (route: { fulfill: (o: { json: unknown }) => unknown }) => route.fulfill({ json: { data } });
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", ok({ id: id(1), displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] }));
  await page.route("**/api/v1/passport**", ok({ policyVersion: "private-work-passport.v1", passportId: id(2), ownerId: id(1), createdAt: time, entries: passportEntries, nextCursor: null }));
  await page.route("**/api/v1/work-records**", ok({ items: records, nextCursor: null }));
  await page.route("**/api/v1/me/employment-history**", ok({ items: [], nextCursor: null }));
  await page.route("**/api/v1/companies**", ok({ items: [{ companyId: id(50), name: "AutoCare Garage" }], scope: "your_authorized_organizations", externalSourceConfigured: false }));
  await page.route("**/api/v1/vault", ok({ items: [doc(10, "Welding certificate", "certificate", "welding-certificate.pdf", 184320), doc(11, "Employer reference letter", "letter", "reference-letter.pdf", 92160)], nextCursor: null }));
  await page.route("**/api/v1/offers?*", ok({ items: offers, nextCursor: null }));
  await page.route("**/api/v1/cv", ok({ items: [], limit: 20 }));
  await page.route("**/api/v1/opportunities?*", ok({ items: [listing(1, "Motorcycle Technician", "AutoCare Garage", "Colombo", "onsite", 95000, "saved"), listing(2, "Warehouse Assistant", "Harbour Logistics", "Galle", "onsite", 80000, "none"), listing(3, "Delivery Coordinator", "QuickDrop Ltd", "Kandy", "hybrid", 90000, "none")], nextCursor: null, preferences: null, preferenceVersion: 0 }));
  await page.route("**/api/v1/applications?view=dashboard", ok({ items: [{ listingId: id(101), title: "Motorcycle Technician", status: "published", expiresAt: "2026-12-31T00:00:00Z", counts: { submitted: 4, reviewing: 2, shortlisted: 1, declined: 0, withdrawn: 0 } }], limit: 100 }));
  await page.route("**/api/v1/agreements?*", ok({ offer: offerFixture, agreementId: offerId, confirmation: null, answers: [], canConfirm: false }));
  await page.route("**/api/v1/offers/assessment?*", ok({ offerId, offerVersion: 2, termHash: hash, assessment: assessOfferTerms(terms as never) }));
}

const screens = [
  ["check", `/app/check?offerId=${offerId}`], ["vault", "/app/work-record"], ["passport", "/app/passport"], ["employer", "/app/employer"],
  ["career", "/app/career-explorer"], ["opportunities", "/app/opportunities"],
] as const;
const sizes = [["1440", 1440, 900], ["1280", 1280, 800], ["1024", 1024, 768], ["390", 390, 844], ["375", 375, 812], ["360", 360, 780]] as const;
for (const [name, url] of screens) {
  for (const [label, width, height] of sizes) {
    test(`${name} ${label}`, async ({ page }) => {
      test.setTimeout(90_000);
      await signedIn(page);
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: "light" });
      await page.goto(url);
      await page.waitForSelector(".fw-product-body, .oq-emp");
      await page.waitForTimeout(1200);
      console.log(`overflow ${name} ${label}: ${await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)}`);
      mkdirSync(`test-results/replica/${set}`, { recursive: true });
      await page.screenshot({ path: `test-results/replica/${set}/${name}-${label}.png`, fullPage: true, animations: "disabled" });
    });
  }
}

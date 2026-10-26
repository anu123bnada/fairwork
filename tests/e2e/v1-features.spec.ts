import { expect, test, type Page } from "@playwright/test";
import { assessOfferTerms } from "../../src/features/offer/assessment";
import { translate } from "../../src/i18n";
const id = "40000000-0000-4000-8000-000000000001", otherId = "40000000-0000-4000-8000-0000000000e1";
const me = { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } };
async function signedIn(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: me }));
}
function pdfBytes(lines: string[]) {
  const stream = lines.length ? `BT /F1 12 Tf 20 160 Td 14 TL ${lines.map(l => `(${l}) Tj T*`).join(" ")} ET` : "";
  return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF`);
}

test("a text PDF is read locally in the browser, reviewed, then moved to the text draft; fakes and scans are refused", async ({ page }) => {
  await signedIn(page);
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers/drafts", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  const uploads: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && request.postData()?.includes("%PDF")) uploads.push(request.url()); });
  await page.goto("/app/add-offer");
  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  const input = page.getByLabel("Offer PDF");
  await input.setInputFiles({ name: "offer.pdf", mimeType: "application/pdf", buffer: pdfBytes(["Salary LKR 90000 per month", "Unpaid trial 30 days"]) });
  const review = page.getByLabel("Review extracted text");
  await expect(review).toHaveValue(/Salary LKR 90000 per month/); await expect(review).toHaveValue(/Unpaid trial 30 days/);
  await expect(page.getByText(/Read 1 of 1 page/)).toBeVisible();
  await page.getByRole("button", { name: "Use this text" }).click();
  await expect(page.getByRole("tab", { name: "Paste text" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByPlaceholder("Paste a job offer here.")).toHaveValue(/Salary LKR 90000 per month/);
  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  await input.setInputFiles({ name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from("<svg><script>alert(1)</script></svg>") });
  await expect(page.locator("p[role=alert]").filter({ hasText: "not a PDF" })).toBeVisible();
  await input.setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: pdfBytes([]) });
  await expect(page.locator("p[role=alert]").filter({ hasText: /no readable text|could not be read/ })).toBeVisible();
  expect(uploads).toEqual([]);
});

test("saved analysis history saves a server snapshot and marks changed terms", async ({ page }) => {
  await signedIn(page);
  const terms = { role: "Workshop Assistant", salary: 80000, currency: "LKR", payPeriod: "monthly", hoursPerWeek: 40, probation: "Unpaid trial is required" };
  const hash = "a".repeat(64), result = assessOfferTerms(terms);
  const offer = { offerId: id, companyId: id, workerId: id, representativeId: null, requesterId: id, requesterRole: "WORKER", version: 2, termHash: hash, snapshot: terms, changes: [], unresolved: [] };
  const saved: unknown[] = []; let posts = 0;
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: { offer, agreementId: id, confirmation: null, answers: [], canConfirm: false } } }));
  await page.route("**/api/v1/offers/assessment?*", route => route.fulfill({ json: { data: { offerId: id, offerVersion: 2, termHash: hash, assessment: result } } }));
  await page.route("**/api/v1/offers/analyses**", route => {
    if (route.request().method() === "POST") {
      posts++; const body = route.request().postDataJSON(); expect(Object.keys(body).sort()).toEqual(["idempotencyKey", "offerId"]);
      saved.unshift({ id: body.idempotencyKey, offerVersion: 2, termHash: hash, engine: result.version, score: result.score, result, savedAt: "2026-10-26T10:00:00Z" });
      return route.fulfill({ json: { data: { id: body.idempotencyKey, saved: true } } });
    }
    return route.fulfill({ json: { data: { offerId: id, items: [...saved, { id: otherId, offerVersion: 1, termHash: "c".repeat(64), engine: result.version, score: 10, result, savedAt: "2026-10-20T10:00:00Z" }] } } });
  });
  await page.goto(`/app/check?offerId=${id}`);
  const history = page.getByRole("region", { name: "Saved analysis history" });
  await expect(history.getByText("earlier terms, since changed")).toBeVisible();
  await history.getByRole("button", { name: "Save this analysis" }).click();
  await expect(history.getByText("Analysis saved to your private history.")).toBeVisible();
  await expect(history.getByText("matches the current terms")).toBeVisible();
  expect(posts).toBe(1);
});

test("self-reported skills are summarized privately and labeled unverified on the Passport screen", async ({ page }) => {
  await signedIn(page);
  await page.route("**/api/v1/passport**", route => route.fulfill({ json: { data: { policyVersion: "private-work-passport.v1", passportId: id, ownerId: id, createdAt: "2026-10-01T00:00:00Z", nextCursor: null, entries: [] } } }));
  const entry = (n: number, role: string, start: string, end: string | null, skills: string[]) => ({ id: `40000000-0000-4000-8000-0000000000f${n}`, revision: 1, savedAt: "2026-10-26T00:00:00Z", verification: "self_reported", content: { employer: `Employer ${n}`, role, startDate: start, endDate: end, current: end === null, skills, achievements: "" } });
  await page.route("**/api/v1/me/employment-history**", route => route.fulfill({ json: { data: { items: [entry(1, "Welder", "2020-01", "2020-12", ["Welding", "Safety"]), entry(2, "Technician", "2021-01", "2021-06", ["welding"])], nextCursor: null } } }));
  await page.goto("/app/passport");
  const panel = page.getByRole("region", { name: "Self-reported skills" });
  await expect(panel).toContainText("Self-reported skills (unverified)");
  await expect(panel.getByText("Welding", { exact: true })).toBeVisible(); await expect(panel).toContainText("about 18 months");
  await expect(panel).toContainText("self-reported"); await expect(panel).toContainText("not part of the verified Passport");
});

test("organization team roster shows membership facts only and cannot change authority", async ({ page }) => {
  await signedIn(page);
  const companyId = "40000000-0000-4000-8000-0000000000d1";
  await page.route("**/api/v1/companies", route => route.fulfill({ json: { data: { items: [{ companyId, name: "Synthetic Works" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/organizations/team?*", route => route.fulfill({ json: { data: { companyId, changeProcess: "operator_reviewed", members: [
    { self: true, role: "representative", status: "active", effectiveAt: "2026-10-20T00:00:00Z", expiresAt: "2026-11-15T00:00:00Z" },
    { self: false, role: "representative", status: "expired", effectiveAt: "2026-08-01T00:00:00Z", expiresAt: "2026-08-30T00:00:00Z" }] } } }));
  await page.route("**/api/v1/organizations", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.goto("/app/employer");
  const roster = page.getByRole("region", { name: "Organization team" });
  await expect(roster.getByRole("heading", { name: "Synthetic Works" })).toBeVisible();
  await expect(roster.getByText("You", { exact: true })).toBeVisible(); await expect(roster.getByText("Representative 2")).toBeVisible();
  await expect(roster).toContainText("expired"); await expect(roster).toContainText("cannot change anyone");
  await expect(roster.getByRole("button")).toHaveCount(0);
});

for (const locale of ["si", "ta", "de"] as const) {
  test(`the local PDF and screenshot readers are translated in ${locale}`, async ({ page }) => {
    await signedIn(page);
    await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
    await page.route("**/api/v1/offers/drafts", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
    await page.goto("/app/settings"); await page.getByLabel("Language").selectOption(locale);
    await page.goto("/app/add-offer");
    await page.getByRole("tab").filter({ hasText: /^PDF$/ }).first().click().catch(() => undefined);
    await expect(page.getByRole("region", { name: translate(locale, "im.pdf.aria") })).toContainText(translate(locale, "im.pdf.title"));
    await page.getByLabel(translate(locale, "im.pdf.file")).setInputFiles({ name: "offer.pdf", mimeType: "application/pdf", buffer: pdfBytes(["Salary LKR 90000 per month"]) });
    await expect(page.getByText(translate(locale, "im.pdf.readOne", { read: 1, total: 1 }))).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\bim\.[a-zA-Z.]+\b/);
  });
}

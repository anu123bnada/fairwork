import { expect, test, type Page } from "@playwright/test";

// The Analyze button end to end: save, rules on the device, the AI request (only with configuration and consent), a popup of real stages, then a clean report screen.
// Transport is a small fake (the AI answer is a fixture, so this is NOT proof of a live model); the screens, stages, consent handling and report are the real code.
const worker = "40000000-0000-4000-8000-000000000001", company = "40000000-0000-4000-8000-000000000002", offerId = "40000000-0000-4000-8000-000000000004";
const TEXT = "Warehouse Picker at Example Stores\nSalary: LKR 85000 per month\n40 hrs/week\nYou must pay a registration fee of LKR 5000 before you start. Guaranteed visa for everyone.";
const aiConfig = (configured: boolean) => configured
  ? { configured: true, provider: "gemini", model: "gemini-synthetic-test", noticeVersion: "offer-analysis.v1", processingRegion: "Region A (synthetic)", dataUse: "Synthetic fixture text", policyHash: "a".repeat(64), fallbacks: [], availability: [{ provider: "gemini", role: "primary", state: "available", retryAfterSeconds: 0 }] }
  : { configured: false, provider: null, model: null, noticeVersion: "offer-analysis.v1", processingRegion: null, dataUse: null, policyHash: null, fallbacks: [], availability: [] };
const aiSuccess = {
  configured: true, provider: "gemini", status: "SUCCESS", message: "Analysis complete.", isAdvisory: true, extractedAt: "2026-11-09T10:00:00Z",
  data: { companyClaimNotice: "Company claims in the offer are not verified.",
    salary: { amount: 85000, currency: "LKR", period: "monthly", taxBasis: "unknown", clarity: "stated", quote: "Salary: LKR 85000 per month", explanation: "The offer states a monthly salary." },
    workingHours: { hoursPerWeek: 40, schedule: null, overtimeTerms: null, clarity: "stated", quote: "40 hrs/week", explanation: "Forty hours a week are stated." },
    contractTerms: { roleTitle: "Warehouse Picker", employmentType: null, location: null, startDate: null, duration: null, responsibilities: null, probationPeriod: null, terminationNotice: null },
    missingDetails: [{ id: "m1", field: "notice period", importance: "important", explanation: "No notice period is stated." }],
    warningSigns: [{ id: "w1", severity: "high", title: "Pay-to-start request", description: "The offer asks you to pay before starting.", quote: "You must pay a registration fee of LKR 5000", recommendation: "Do not pay; ask for written proof." }],
    followUpQuestions: [{ id: "q1", field: "fees", importance: "critical", question: "Why is a registration fee required?", rationale: "Fees to start work are a common scam sign." }] },
};

async function setup(page: Page, options: { configured: boolean; noCompany?: boolean; analyze?: (post: Record<string, unknown>) => { status: number; json: unknown }; delayMs?: number }, posts: Record<string, unknown>[] = [], offerPosts: Record<string, unknown>[] = []) {
  let version = 0; let snapshot: Record<string, unknown> | undefined;
  const offer = () => ({ offerId, companyId: company, workerId: worker, representativeId: worker, requesterId: worker, requesterRole: "WORKER", version, termHash: (version.toString(16) + "a".repeat(64)).slice(0, 64), snapshot, changes: [], unresolved: [] });
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: options.noCompany ? [] : [{ companyId: company, name: "Synthetic organization" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers/drafts**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers/analyses**", route => route.fulfill({ json: { data: { offerId, items: [] } } }));
  await page.route("**/api/v1/offers/analyze", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: aiConfig(options.configured) } });
    const body = route.request().postDataJSON() as Record<string, unknown>; posts.push(body);
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
    const result = options.analyze?.(body) ?? { status: 200, json: { data: aiSuccess } };
    return route.fulfill({ status: result.status, json: result.json as object });
  });
  await page.route("**/api/v1/offers", route => {
    const body = route.request().postDataJSON() as { terms: Record<string, unknown>; expectedVersion: number };
    offerPosts.push(body);
    version = body.expectedVersion; snapshot = body.terms;
    return route.fulfill({ json: { data: offer() } });
  });
  await page.goto("/app/add-offer");
  await page.getByLabel("Paste offer text").fill(TEXT);
  await page.getByRole("button", { name: "Suggest terms with local rules" }).click();
  await page.getByLabel("Role title", { exact: true }).fill("Warehouse Picker");
  if (!options.noCompany) await page.getByLabel("Company organization", { exact: true }).selectOption(company);
}

test("with AI configured and consent given, Analyze shows real stages in a popup, asks the model once, then opens a clean report with the AI findings kept separate", async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  await setup(page, { configured: true, delayMs: 1200 }, posts);
  const consent = page.getByLabel("AI analysis choice");
  await expect(consent).toContainText("gemini-synthetic-test");
  await consent.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Analyzing your offer" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-stage="save"][data-state="done"]')).toBeVisible();
  await expect(dialog.locator('[data-stage="rules"][data-state="done"]')).toBeVisible();
  await expect(dialog.locator('[data-stage="ai"][data-state="active"]')).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Stop waiting for AI" })).toBeVisible();

  await expect(page).toHaveURL(/\/app\/report$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const report = page.getByLabel("Offer analysis report", { exact: true });
  await expect(report.getByRole("heading", { name: "Offer analysis report" })).toBeVisible();
  await expect(report.getByLabel("Executive summary")).toContainText("AI analysis ran (gemini, model gemini-synthetic-test)");
  const ai = report.getByLabel("AI analysis findings");
  await expect(ai).toContainText("Pay-to-start request");
  await expect(ai).toContainText("Why is a registration fee required?");
  await expect(report.getByLabel("Confidence and limitations")).toContainText("neither is legal advice");
  await expect(report.getByRole("link", { name: /See ORYQEN Check/ })).toBeVisible();

  // Exactly one request reached the model, with the person's explicit consent bound to the policy version.
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ role: "WORKER", consent: { provider: "gemini", transmit: true, adultConfirmed: true, policyHash: "a".repeat(64) } });
});

test("without ticking the consent box nothing is sent to the model, and the report says so", async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  await setup(page, { configured: true }, posts);
  await expect(page.getByLabel("AI analysis choice").getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  const report = page.getByLabel("Offer analysis report", { exact: true });
  await expect(report).toBeVisible();
  await expect(report.getByLabel("Executive summary")).toContainText("You did not choose AI for this analysis");
  await expect(report.getByLabel("AI analysis findings")).toHaveCount(0);
  expect(posts).toEqual([]);
});

test("when AI is not configured the screen says so, no consent box is offered, and the rules report is complete", async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  await setup(page, { configured: false }, posts);
  await expect(page.getByLabel("AI analysis choice")).toHaveCount(0);
  await expect(page.getByText("AI analysis is not available right now")).toBeVisible();
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  const report = page.getByLabel("Offer analysis report", { exact: true });
  await expect(report.getByLabel("Executive summary")).toContainText("AI analysis is not configured");
  await expect(report.getByText(/registration fee/i).first()).toBeVisible();
  expect(posts).toEqual([]);
});

test("if the model fails the report still opens with the rules and shows the failure plainly", async ({ page }) => {
  await setup(page, { configured: true, analyze: () => ({ status: 200, json: { data: { configured: true, provider: "gemini", status: "RATE_LIMITED", message: "The AI provider is over its quota. Try again later.", isAdvisory: true, extractedAt: "2026-11-09T10:00:00Z", data: null, retryAfterSeconds: 600 } } }) });
  await page.getByLabel("AI analysis choice").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  const report = page.getByLabel("Offer analysis report", { exact: true });
  await expect(report).toBeVisible();
  await expect(report.getByLabel("Executive summary")).toContainText("did not complete: The AI provider is over its quota");
  await expect(report.getByLabel("AI analysis findings")).toHaveCount(0);
  await expect(report.getByLabel("Executive summary")).toContainText("rules");
});

test("stopping the wait for AI skips it and still opens the rules report; a reload rebuilds the report from saved terms", async ({ page }) => {
  await setup(page, { configured: true, delayMs: 8000 });
  await page.getByLabel("AI analysis choice").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Analyzing your offer" });
  await dialog.getByRole("button", { name: "Stop waiting for AI" }).click();
  const report = page.getByLabel("Offer analysis report", { exact: true });
  await expect(report).toBeVisible();
  await expect(report.getByLabel("Executive summary")).toContainText("You stopped waiting for AI");
});

test("a malformed AI answer is discarded with a plain message, never shown as a technical dump", async ({ page }) => {
  await setup(page, { configured: true, analyze: () => ({ status: 200, json: { data: { configured: true, provider: "gemini", status: "SUCCESS", message: "ok", isAdvisory: true, extractedAt: "2026-11-09T10:00:00Z", data: { salary: { amount: 1 } } } } }) });
  await page.getByLabel("AI analysis choice").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  const summary = page.getByLabel("Offer analysis report", { exact: true }).getByLabel("Executive summary");
  await expect(summary).toContainText("The AI answer was not in the expected format");
  await expect(summary).not.toContainText("invalid_value");
  await expect(summary).not.toContainText('"path"');
});

test("a visitor with no organization can still run the analysis and the AI step; nothing is saved and the report says so", async ({ page }) => {
  const posts: Record<string, unknown>[] = [], offerPosts: Record<string, unknown>[] = [];
  await setup(page, { configured: true, noCompany: true }, posts, offerPosts);
  await page.getByLabel("AI analysis choice").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Analyzing your offer" });
  await expect(dialog).toBeVisible();
  const report = page.getByLabel("Offer analysis report", { exact: true });
  await expect(report).toBeVisible();
  await expect(report.getByLabel("Executive summary")).toContainText("This analysis was not saved");
  await expect(report.getByLabel("Executive summary")).toContainText("AI analysis ran (gemini");
  await expect(report.getByLabel("AI analysis findings")).toContainText("Pay-to-start request");
  await expect(report.getByRole("link", { name: "Keep as a private draft" })).toBeVisible();
  await expect(report.getByRole("link", { name: /See ORYQEN Check/ })).toHaveCount(0);
  expect(offerPosts).toEqual([]);
  expect(posts).toHaveLength(1);
});

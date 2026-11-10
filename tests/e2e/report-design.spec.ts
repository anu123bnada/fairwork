import { expect, test, type Page } from "@playwright/test";

// The redesigned Offer analysis report. The analysis engines are the real ones; only the network is a fixture. AI is deliberately not configured here, so the disclosure that no AI was used is also checked.
const worker = "40000000-0000-4000-8000-000000000001", company = "40000000-0000-4000-8000-000000000002", offerId = "40000000-0000-4000-8000-000000000004";
const RISKY = "Warehouse Picker at Example Stores\nSalary: LKR 85000 per month\n40 hrs/week\nYou must pay a registration fee of LKR 5000 before you start. Guaranteed visa for everyone.";
const PLAIN = "Office Clerk at Example Stores\nWe will contact you with more information soon.";

async function open(page: Page, text: string, options: { linked: boolean }) {
  let version = 0; let snapshot: Record<string, unknown> | undefined;
  const offer = () => ({ offerId, companyId: company, workerId: worker, representativeId: worker, requesterId: worker, requesterRole: "WORKER", version, termHash: (version.toString(16) + "a".repeat(64)).slice(0, 64), snapshot, changes: [], unresolvedQuestions: [], questions: [], answers: [], agreement: null });
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: options.linked ? [{ companyId: company, name: "Synthetic organization" }] : [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers/drafts**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers/analyses**", route => route.fulfill({ json: { data: { offerId, items: [] } } }));
  await page.route("**/api/v1/offers/analyze", route => route.fulfill({ json: { data: { configured: false, provider: null, model: null, noticeVersion: "offer-analysis.v1", processingRegion: null, dataUse: null, policyHash: null, fallbacks: [], availability: [] } } }));
  await page.route("**/api/v1/offers", route => { const body = route.request().postDataJSON() as { terms: Record<string, unknown>; expectedVersion: number }; version = body.expectedVersion; snapshot = body.terms; return route.fulfill({ json: { data: offer() } }); });
  await page.goto("/app/add-offer");
  await page.getByLabel("Paste offer text").fill(text);
  await page.getByRole("button", { name: "Suggest terms with local rules" }).click();
  await page.getByLabel("Role title", { exact: true }).fill("Warehouse Picker");
  if (options.linked) await page.getByLabel("Company organization", { exact: true }).selectOption(company);
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  const report = page.getByLabel("Offer analysis report", { exact: true });
  await expect(report).toBeVisible();
  return report;
}

test("a report with warnings, unclear or missing clauses and unspecified details: summary, five sections, collapsible explanations, working actions, and visible limits", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", message => { if (message.type() === "error" && !/Failed to load resource/.test(message.text())) consoleErrors.push(message.text()); });
  page.on("pageerror", error => consoleErrors.push(error.message));
  const report = await open(page, RISKY, { linked: false });

  // One heading level 1 only (the page header title is no longer repeated).
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(report.getByRole("heading", { level: 1, name: "Offer analysis report" })).toBeVisible();

  // Summary: real counts, method and saved state; no invented score; zero/non-zero explained.
  const summary = report.getByLabel("Executive summary");
  const stats = summary.getByLabel("Result at a glance");
  await expect(stats).toContainText("Warning phrases matched");
  await expect(stats).toContainText("Missing or unclear clauses");
  await expect(stats).toContainText("Unspecified details");
  await expect(stats.locator("li").filter({ hasText: "Method" })).toContainText("Rule-based");
  await expect(stats.locator("li").filter({ hasText: "Saved" })).toContainText("Not saved");
  await expect(summary).toContainText("warning phrase(s) matched");
  await expect(summary).toContainText("AI analysis is not configured");
  await expect(summary).toContainText("This analysis was not saved");
  await expect(summary).not.toContainText(/score|rating|safe to accept/i);

  // Five lettered sections with counts, in order.
  for (const [id, title] of [["rp-warnings", "Important warnings"], ["rp-clauses", "Missing or unclear clauses"], ["rp-missing", "Details the employer has not specified"], ["rp-questions", "Questions to ask the employer"], ["rp-next", "Recommended next steps"]] as const) {
    await expect(report.locator(`#${id}`).getByRole("heading", { name: title })).toBeVisible();
  }
  const warnings = report.locator("#rp-warnings");
  await expect(warnings).toContainText("registration fee");
  await expect(warnings).toContainText("Fee or deposit wording to review");

  // A finding's longer explanation is collapsed until opened.
  const more = warnings.locator("details.oq-finding-more").first();
  await expect(more).not.toHaveAttribute("open", "");
  await more.locator("summary").click();
  await expect(more).toContainText("Clarify the amount, purpose, recipient and refund conditions");

  // Unspecified details explain why they matter and what to ask.
  const missing = report.locator("#rp-missing");
  await expect(missing.locator("article").first()).toBeVisible();
  await missing.locator("details.oq-finding-more").first().locator("summary").click();
  await expect(missing).toContainText("What to ask");

  // Questions can be copied; next steps name real actions; the original text can be read.
  await expect(report.locator("#rp-questions").getByRole("button", { name: "Copy these questions" })).toBeVisible();
  await expect(report.getByRole("link", { name: "Keep as a private draft" })).toBeVisible();
  await expect(report.getByRole("link", { name: "Edit the offer" })).toBeVisible();
  await expect(report.getByRole("button", { name: "Print or save report as PDF" })).toBeVisible();
  await expect(report.getByRole("link", { name: /See ORYQEN Check/ })).toHaveCount(0);
  await expect(report.locator("#rp-next")).toContainText("needs an organization linked to the offer");
  await report.getByText("View the original offer text").click();
  await expect(report.getByLabel("Original offer text")).toContainText("registration fee of LKR 5000");

  // Disclosures stay visible but secondary.
  const limits = report.getByLabel("Confidence and limitations");
  for (const line of ["not AI", "not legal advice", "not an independently verified fact", "does not mean an offer is safe, fair or complete", "temporary"]) await expect(limits).toContainText(line);

  // Jump links go to real sections.
  await report.getByRole("link", { name: "Questions to ask the employer" }).first().click();
  await expect(page).toHaveURL(/#rp-questions$/);
  expect(consoleErrors).toEqual([]);
});

test("zero matched warning phrases is explained as not meaning safe or fair, and the unspecified details are still counted", async ({ page }) => {
  const report = await open(page, PLAIN, { linked: false });
  const summary = report.getByLabel("Executive summary");
  await expect(summary.getByRole("note")).toContainText("No warning phrases matched.");
  await expect(summary.getByRole("note")).toContainText("does not mean this offer is safe or fair");
  const stats = summary.getByLabel("Result at a glance");
  await expect(stats.locator("li").filter({ hasText: "Warning phrases matched" })).toContainText("0");
  await expect(stats.locator("li").filter({ hasText: "Warning phrases matched" })).toContainText("not a safety rating");
  await expect(report.locator("#rp-warnings")).toContainText("No configured warning phrases matched");
  await expect(report.locator("#rp-missing").locator("article").first()).toBeVisible();
});

test("a saved report shows Saved and the working links to continue, and does not offer the private-draft fallback", async ({ page }) => {
  const report = await open(page, RISKY, { linked: true });
  const stats = report.getByLabel("Executive summary").getByLabel("Result at a glance");
  await expect(stats.locator("li").filter({ hasText: "Saved" })).toContainText("Kept with your offer");
  await expect(report.getByRole("link", { name: /See ORYQEN Check/ })).toBeVisible();
  await expect(report.getByRole("link", { name: "Continue to the agreement questions" })).toBeVisible();
  await expect(report.getByRole("link", { name: "Keep as a private draft" })).toHaveCount(0);
});

for (const size of [{ name: "laptop 1280", width: 1280, height: 800 }, { name: "desktop 1920", width: 1920, height: 1000 }, { name: "tablet 768", width: 768, height: 1024 }, { name: "phone 375", width: 375, height: 812 }]) {
  test(`layout at ${size.name}: no sideways scroll, and on wide screens the side navigation keeps one width, does not wrap the logo and does not scroll`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await open(page, RISKY, { linked: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (process.env.ORYQEN_SHOTS) await page.screenshot({ path: `test-results/report-${size.width}.png`, fullPage: true });
    if (size.width >= 768) {
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      const box = await nav.boundingBox();
      expect(box!.width).toBeLessThan(200);
      const brand = nav.locator(".fw-nav-brand");
      const brandBox = await brand.boundingBox();
      expect(brandBox!.height, "the ORYQEN brand must stay on one line").toBeLessThan(60);
      expect(await brand.locator("span").first().evaluate(node => node.getBoundingClientRect().height)).toBeLessThan(24);
      expect(await nav.evaluate(node => node.scrollHeight <= node.clientHeight + 1), "the collapsed side navigation must not need its own scrollbar").toBe(true);
    }
  });
}

test("the More tools list in the side navigation is collapsed until opened", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, RISKY, { linked: false });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Application tracker" })).toBeHidden();
  await nav.getByText("More", { exact: true }).click();
  await expect(nav.getByRole("link", { name: "Application tracker" })).toBeVisible();
});

import { expect, test } from "@playwright/test";

// Transport is mocked by a small stateful fake; the screens, form logic, rule extraction and rule findings are the real code.
// Real-database persistence of the same commands is covered by tests/integration/day3-offer-db.test.ts.
const worker = "40000000-0000-4000-8000-000000000001", company = "40000000-0000-4000-8000-000000000002";
const offerId = "40000000-0000-4000-8000-000000000004", agreementId = "40000000-0000-4000-8000-000000000005";
const REQUIRED = [["salary", "What pay amount applies?"], ["currency", "Which currency is the pay in?"], ["startDate", "When does the job start?"], ["hoursPerWeek", "How many hours a week?"], ["responsibilities", "What will the role involve?"]] as const;

test("add offer, review, save, check findings, answer, reopen after reload, amend, continue to agreement", async ({ page }) => {
  const saved: { snapshot?: Record<string, unknown>; version: number; questions: Array<{ id: string; field: string; question: string; required: boolean }>; answers: Array<{ questionId: string; answer: string; answeredBy: string }> } = { version: 0, questions: [], answers: [] };
  const posts: Array<Record<string, unknown>> = [];
  const hash = () => (saved.version.toString(16) + "a".repeat(64)).slice(0, 64);
  const offer = () => ({ offerId, companyId: company, workerId: worker, representativeId: worker, requesterId: worker, requesterRole: "WORKER", version: saved.version, termHash: hash(), snapshot: saved.snapshot, changes: [], unresolved: saved.questions });
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [{ companyId: company, name: "Synthetic organization" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers/drafts**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers/analyze", route => route.fulfill({ json: { data: { configured: false, provider: null, model: null, noticeVersion: "offer-analysis.v1", processingRegion: null, dataUse: null, policyHash: null, fallbacks: [], availability: [] } } }));
  await page.route("**/api/v1/offers/analyses**", route => route.fulfill({ json: { data: { offerId, items: [] } } }));
  await page.route("**/api/v1/offers", route => {
    const body = route.request().postDataJSON() as { terms: Record<string, unknown>; expectedVersion: number };
    posts.push(body);
    if (body.expectedVersion !== saved.version + 1) return route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT" } } });
    saved.version = body.expectedVersion; saved.snapshot = body.terms;
    saved.questions = REQUIRED.filter(([field]) => !(field in body.terms)).map(([field, question], index) => ({ id: `40000000-0000-4000-8000-0000000000b${index}`, field, question, required: true }));
    return route.fulfill({ json: { data: offer() } });
  });
  await page.route("**/api/v1/offers/answers", route => {
    const body = route.request().postDataJSON() as { questionId: string; answer: string };
    saved.answers.push({ questionId: body.questionId, answer: body.answer, answeredBy: worker });
    return route.fulfill({ json: { data: { saved: true } } });
  });
  await page.route("**/api/v1/agreements?*", route => saved.snapshot
    ? route.fulfill({ json: { data: { offer: offer(), agreementId, confirmation: null, answers: saved.answers, canConfirm: true } } })
    : route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } }));

  // Paste, take the local suggestions, then correct a suggested field before saving.
  await page.goto("/app/add-offer");
  await page.getByLabel("Paste offer text").fill("Warehouse Picker at Example Stores\nSalary: LKR 85000 per month\n40 hrs/week\nSecurity deposit: LKR 5000");
  await page.getByRole("button", { name: "Suggest terms with local rules" }).click();
  await expect(page.getByLabel("Pay amount")).toHaveValue("85000");
  await page.getByLabel("Role title", { exact: true }).fill("Warehouse Picker");
  await page.getByLabel("Pay amount").fill("86000");
  await page.getByLabel("Company organization", { exact: true }).selectOption(company);
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();

  await expect(page.getByRole("heading", { name: /Checking \d+ offer details/ })).toBeVisible();
  expect(posts[0]).toMatchObject({ companyId: company, workerId: worker, requesterRole: "WORKER", expectedVersion: 1 });
  expect(posts[0]!.terms).toMatchObject({ role: "Warehouse Picker", salary: 86000, currency: "LKR", hoursPerWeek: 40 });
  expect(posts[0]!.terms).not.toHaveProperty("startDate"); // unknown terms are omitted so the server asks about them

  // Findings come from the saved revision and the local rules; no AI is involved.
  await page.getByRole("link", { name: /See ORYQEN Check/ }).click();
  const overview = page.getByRole("region", { name: "What the check found" });
  await expect(overview.getByRole("link", { name: /Missing/ })).toContainText("2");
  await expect(overview).toContainText("No AI was used on this screen");
  await expect(page.getByRole("region", { name: "Rule-based considerations" })).toBeVisible();

  // Questions, then reload and reopen by id: terms and answers come back from the server fake, not from page state.
  await page.locator(".fw-fixed-action").getByRole("link", { name: /Questions to ask/ }).click();
  const first = saved.questions[0]!;
  await page.getByLabel(`Your answer to ${first.question}`).fill("From 1 December.");
  await page.getByRole("button", { name: "Save answer" }).first().click();
  await expect(page.getByText("Answer saved for this question and offer revision.")).toBeVisible();
  await page.goto(`/app/check?offerId=${offerId}`);
  await expect(page.getByRole("region", { name: "What the check found" })).toBeVisible();
  await expect(page.getByText("Warehouse Picker").first()).toBeVisible();
  await page.goto(`/app/questions?offerId=${offerId}`);
  await expect(page.getByText("From 1 December.")).toBeVisible();

  // Amend the saved offer: the editor opens on the saved terms and writes revision 2.
  await page.goto(`/app/add-offer?offerId=${offerId}`);
  await expect(page.getByLabel("Role title", { exact: true })).toHaveValue("Warehouse Picker");
  await page.getByLabel("Start date", { exact: true }).fill("2026-12-01");
  await page.getByRole("textbox", { name: "Responsibilities", exact: true }).fill("Pick and pack orders");
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Checking \d+ offer details/ })).toBeVisible();
  expect(posts[1]).toMatchObject({ expectedVersion: 2 });
  await page.getByRole("link", { name: /See ORYQEN Check/ }).click();
  await page.getByRole("link", { name: /Review agreement/ }).click();
  await expect(page.getByRole("heading", { name: "Agreement summary" })).toBeVisible();
  await expect(page.getByText("Offer revision 2")).toBeVisible();
});

test("a service failure keeps the entries and a retry reuses the same request key", async ({ page }) => {
  const keys: string[] = [];
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [{ companyId: company, name: "Synthetic organization" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers/drafts**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers", route => { keys.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey); return route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }); });
  await page.goto("/app/add-offer");
  await page.getByRole("tab", { name: "Enter manually" }).click();
  await page.getByLabel("Role title", { exact: true }).fill("Cleaner");
  await page.getByRole("textbox", { name: "Benefits (optional)", exact: true }).fill("Meals");
  await expect(page.locator("#offer-company option")).toHaveCount(2);
  await page.getByLabel("Company organization", { exact: true }).selectOption(company);
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  await expect(page.locator(".fw-error[role='alert']")).toContainText("could not reach the secure service");
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  await expect(page.locator(".fw-error[role='alert']")).toBeVisible();
  expect(keys).toHaveLength(2); expect(keys[1]).toBe(keys[0]);
  await expect(page.getByLabel("Role title", { exact: true })).toHaveValue("Cleaner");
  await expect(page.getByRole("textbox", { name: "Benefits (optional)", exact: true })).toHaveValue("Meals");
});

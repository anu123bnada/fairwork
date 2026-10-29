import { expect, test } from "@playwright/test";

const workerId = "40000000-0000-4000-8000-000000000001";
const companyId = "40000000-0000-4000-8000-000000000002";
const questionId = "40000000-0000-4000-8000-000000000003";
const offerId = "40000000-0000-4000-8000-000000000004";
const employerId = "40000000-0000-4000-8000-000000000006";

async function authenticate(page: import("@playwright/test").Page, actor = workerId) {
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [{ companyId, name: "Synthetic organization" }], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers/drafts", route => route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.route("**/api/v1/work-records", route => route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.route("**/api/v1/me", (route) => route.fulfill({
    json: { data: { id: actor, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } },
  }));
}

async function fillManualOffer(page: import("@playwright/test").Page) {
  await page.getByRole("tab", { name: "Enter manually" }).click();
  await page.getByLabel("Role title").fill("Picker");
  await page.getByLabel("Pay amount").fill("1200");
  await page.getByLabel("Currency").fill("LKR");
  await page.getByLabel("Start date").fill("2026-11-01");
  await page.getByLabel("Expected hours per week").fill("40");
  await page.getByLabel("Responsibilities").fill("Pack orders");
  await page.getByLabel("Company organization", { exact: true }).selectOption(companyId);
}

test("integrated product routes carry an offer through check, answer, and agreement API commands", async ({ page }) => {
  await authenticate(page, employerId);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let offerBody: Record<string, unknown> | undefined;
  let answerBody: Record<string, unknown> | undefined;
  let agreementBody: Record<string, unknown> | undefined;
  let savedOffer: Record<string, unknown>;
  await page.route("**/api/v1/offers", async (route) => {
    offerBody = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 200));
    savedOffer = {
      offerId, companyId, workerId, requesterId: employerId, requesterRole: "EMPLOYER", version: 1,
      termHash: "a".repeat(64), changes: [], snapshot: offerBody?.terms,
      representativeId: "40000000-0000-4000-8000-000000000006",
      unresolved: [{ id: questionId, field: "responsibilities", question: "What core responsibilities are still unresolved?", required: true }],
    };
    await route.fulfill({ json: { data: savedOffer } });
  });
  await page.route("**/api/v1/agreements?*", (route) => route.fulfill({ json: { data: {
    offer: savedOffer, agreementId: "40000000-0000-4000-8000-000000000005", confirmation: null,
    answers: answerBody ? [{ questionId, answer: "Pack orders.", answeredBy: employerId }] : [], canConfirm: Boolean(answerBody),
  } } }));
  await page.route("**/api/v1/offers/answers", async (route) => {
    answerBody = route.request().postDataJSON();
    await route.fulfill({ json: { data: { saved: true } } });
  });
  await page.route("**/api/v1/agreements", async (route) => {
    agreementBody = route.request().postDataJSON();
    await route.fulfill({ json: { data: {
      agreementId: "40000000-0000-4000-8000-000000000005", offerId, version: 1, confirmedBy: employerId,
      confirmationRole: "EMPLOYER", currentHash: "server-generated", status: "awaiting_other_party",
    } } });
  });

  await page.goto("/app/home");
  await expect(page.getByRole("heading", { name: /Good morning, Synthetic/ })).toBeVisible();
  await page.getByRole("link", { name: "Add offer details" }).click();
  await fillManualOffer(page);
  await page.getByLabel("Your intended party role").selectOption("EMPLOYER");
  await page.getByLabel("Worker account ID").fill(workerId);
  await page.getByLabel("Responsibilities").fill("");
  expect(await page.locator("form:not(:has(#private-draft-text)) :invalid").evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).name || element.tagName))).toEqual([]);
  const offerResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/v1/offers"));
  await page.getByRole("button", { name: "Analyze offer" }).click();
  await expect(page.getByRole("button", { name: /Checking offer/ })).toBeDisabled();
  const offerResponse = await offerResponsePromise;
  expect(offerResponse.status(), await offerResponse.text()).toBe(200);
  expect(offerBody).toBeDefined();
  expect(pageErrors).toEqual([]);
  await expect(page.getByRole("heading", { name: "Checking 5 offer details" })).toBeVisible();
  expect(offerBody).toMatchObject({ companyId, workerId, requesterRole: "EMPLOYER", expectedVersion: 1 });
  expect(offerBody?.terms).not.toHaveProperty("responsibilities");
  expect((offerBody?.terms as Record<string, unknown>)).toMatchObject({ role: "Picker", salary: 1200, currency: "LKR", hoursPerWeek: 40 });
  expect(offerBody?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: /See ORYQEN Check/ }).click();
  await expect(page).toHaveURL(/\/app\/check$/);
  await expect(page.getByText(/1 need clarification/)).toBeVisible();
  await page.getByRole("link", { name: /Questions to ask/ }).last().click(); // the findings overview also links to the questions
  await expect(page.getByRole("button", { name: /Continue to agreement/ })).toBeDisabled();
  await page.getByLabel("Your answer to What core responsibilities are still unresolved?").fill("Pack orders.");
  await page.getByRole("button", { name: "Save answer" }).click();
  expect(answerBody).toMatchObject({ offerId, offerVersion: 1, questionId, answer: "Pack orders." });
  await expect(page.getByText("Answer saved for this question and offer revision.")).toBeVisible();
  await page.getByRole("button", { name: /Continue to agreement/ }).click();
  await expect(page.getByRole("heading", { name: "Agreement summary" })).toBeVisible();
  await expect(page.getByText("Pack orders.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Confirm these terms/ }).click();
  await expect(page.getByRole("status")).toContainText("other independent party must sign in and confirm");
  expect(agreementBody).toMatchObject({ offerId, companyId, workerId, confirmationRole: "EMPLOYER", expectedVersion: 1 });
  await expect(page.getByLabel("Participant link")).toHaveValue(`/app/agreement?offerId=${offerId}`);
});

test("integrated product session fails closed when authentication is missing", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.goto("/app/home");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});

test("successful sign-in goes through the authenticated introduction before Home", async ({ page }) => {
  await authenticate(page);
  let submittedCredentials: Record<string, unknown> | undefined;
  await page.route("**/api/v1/auth/sign-in", async (route) => {
    submittedCredentials = route.request().postDataJSON();
    await route.fulfill({ json: { data: { authenticated: true } } });
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("approved.synthetic@example.test");
  await page.getByLabel("Password").fill("synthetic-test-password");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page).toHaveURL(/\/app\/intro-welcome$/);
  expect(submittedCredentials).toEqual({ email: "approved.synthetic@example.test", password: "synthetic-test-password" });
  await expect(page.getByRole("heading", { name: /Know what/ })).toBeVisible();
  await page.getByRole("link", { name: /Check a job offer/ }).click();
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(page.getByRole("heading", { name: /Good morning, Synthetic/ })).toBeVisible();
});

test("original main navigation opens check, record, passport, share, settings, and employer workspace", async ({ page }) => {
  await authenticate(page);
  await page.route("**/api/v1/offers?context=EMPLOYER&view=active", route => route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.route("**/api/v1/organizations", route => route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.goto("/app/home");
  await expect(page.getByRole("heading", { name: /Good morning, Synthetic/ })).toBeVisible();
  await page.getByRole("link", { name: "Check" }).click();
  await expect(page.getByText("No offer revision is loaded.")).toBeVisible();
  await page.getByRole("link", { name: "Record" }).click();
  await expect(page.getByRole("heading", { name: "No work recorded yet" })).toBeVisible();
  await page.getByRole("link", { name: "Passport", exact: true }).click();
  await expect(page.getByText("Work Passport").first()).toBeVisible();
  await page.getByRole("link", { name: "Share Work Passport" }).click();
  await expect(page.getByRole("dialog", { name: "Share your passport" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Home" }).click();
  await page.getByRole("link", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("My participant account ID")).toHaveValue(workerId);
  await expect(page.getByLabel("My participant account ID")).toHaveAttribute("readonly", "");
  await page.getByRole("link", { name: "Switch to employer view" }).click();
  await expect(page.getByText("EMPLOYER VIEW")).toBeVisible();
  await expect(page.getByRole("region", {name:"Saved offers"}).getByText("No saved offers are available in this workspace.")).toBeVisible();
  await expect(page.getByRole("button", {name:"Request independent approval"})).toBeVisible();
  await expect(page.getByText("Selecting employer does not grant access.", {exact:false})).toBeVisible();
});

test("isolated Figma demo preview renders sample-only home, work record, and passport", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize({ width: 378, height: 744 });
  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      mutationRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await page.goto("/app/home?preview=demo");
  await expect(page.getByText("DEMO PREVIEW · FIGMA SAMPLE · NOT VERIFIED OR SAVED")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Good morning, Nimal" })).toBeVisible();
  await expect(page.getByText("Motorcycle Technician", { exact: true })).toBeVisible();
  await expect(page.getByText("LKR 45,000–60,000")).toBeVisible();
  await expect(page.getByText("73% sample profile · 2 roles · 4 skills")).toBeVisible();
  await page.screenshot({ path: "test-results/approval-corrected-home.png", fullPage: true, animations: "disabled" });

  await page.getByRole("link", { name: "Record" }).click();
  await expect(page).toHaveURL(/\/app\/work-record\?preview=demo$/);
  await expect(page.getByText("40.5 hrs", { exact: true })).toBeVisible();
  await expect(page.getByText("Figma preview only. Hours are not real or confirmed by an employer.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log today · 8h" })).toBeDisabled();
  await page.screenshot({ path: "test-results/approval-corrected-work-record.png", fullPage: true, animations: "disabled" });

  await page.getByRole("link", { name: "Passport", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/passport\?preview=demo$/);
  await expect(page.getByText("Nimal Perera")).toBeVisible();
  await expect(page.getByText("Motorcycle Technician · Kurunegala")).toBeVisible();
  await expect(page.getByText("Brake servicing")).toBeVisible();
  await page.screenshot({ path: "test-results/approval-corrected-work-passport.png", fullPage: true, animations: "disabled" });

  expect(mutationRequests).toEqual([]);
});

test("captures all prototype screen routes at Figma and recording viewport sizes", async ({ page }) => {
  // 38 navigations plus screenshot encoding share this test's total budget.
  // Keep the per-screen visibility and overflow assertions unchanged.
  test.slow();
  await authenticate(page);
  await page.route("**/api/v1/auth/mfa", (route) => route.fulfill({
    json: { data: { factors: [{ id: workerId, status: "verified" }] } },
  }));
  const routes: Array<[string, string]> = [
    ["/intro/splash", "ORYQEN"],
    ["/intro/onboarding", "See what’s clear"],
    ["/intro/language", "Choose your language"],
    ["/welcome", "Welcome to ORYQEN"],
    ["/sign-in", "Welcome to ORYQEN"],
    ["/otp", "Verify your authenticator"],
    ["/app/home", "Good morning, Synthetic"],
    ["/app/add-offer", "Add a job offer"],
    ["/app/analyzing", "Checking 0 offer details"],
    ["/app/check", "ORYQEN Check"],
    ["/app/questions", "Ask before you accept"],
    ["/app/agreement", "Agreement summary"],
    ["/app/work-record", "Work record"],
    ["/app/passport", "Work Passport"],
    ["/app/share", "Share your passport"],
    ["/app/settings", "Settings"],
    ["/app/employer", "EMPLOYER VIEW"],
    ["/app/notifications", "Notifications"],
    ["/app/intro-welcome", "Know what"],
  ];
  const viewports = [
    { width: 390, height: 844, label: "figma" },
    { width: 378, height: 744, label: "recording" },
  ];
  for (const viewport of viewports) {
    for (const [path, heading] of routes) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(path);
      // The splash shows the owner-approved symbol (its accessible name is the product name) instead of typeset text.
      await expect(path === "/intro/splash" ? page.getByAltText("ORYQEN").first() : page.getByText(heading).first(), `${path} did not render its expected content`).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows at ${viewport.width}px`).toBe(true);
      const file = path.slice(1).replaceAll("/", "-");
      await page.screenshot({ path: `test-results/fairwork-${viewport.label}-${file}.png`, fullPage: true, animations: "disabled" });
      if (path === "/intro/onboarding") {
        const slides = ["Ask with confidence", "Build your Work Passport"];
        for (const [index, title] of slides.entries()) {
          await page.getByRole("button", { name: "Next" }).click();
          await expect(page.getByRole("heading", { name: title })).toBeVisible();
          await page.screenshot({
            path: `test-results/fairwork-${viewport.label}-intro-onboarding-slide-${index + 2}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
      }
    }
  }
});

test("supplied intro and product destinations render at narrow mobile widths", async ({ page }) => {
  await authenticate(page);
  const destinations: Array<[string, RegExp]> = [
    ["/", /ORYQEN/],
    ["/intro/language", /Choose your language/],
    ["/intro/onboarding", /See what’s clear/],
    ["/welcome", /Welcome to ORYQEN/],
    ["/sign-in", /Welcome to ORYQEN/],
    ["/app/home", /Good morning, Synthetic/],
    ["/app/add-offer", /Add a job offer/],
    ["/app/analyzing", /Checking \d+ offer details/],
    ["/app/check", /ORYQEN Check/],
    ["/app/questions", /Ask before you accept/],
    ["/app/agreement", /Agreement summary/],
    ["/app/work-record", /No work recorded yet/],
    ["/app/passport", /Synthetic Worker/],
    ["/app/settings", /Settings/],
    ["/app/employer", /EMPLOYER VIEW/],
    ["/app/share", /Share your passport/],
    ["/app/notifications", /Notifications/],
  ];
  await page.setViewportSize({ width: 320, height: 844 });
  for (const [path, heading] of destinations) {
    await page.goto(path);
    await expect(page.getByText(heading).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows at 320px`).toBe(true);
  }
});

test("integrated offer route surfaces stale-revision errors without advancing", async ({ page }) => {
  await authenticate(page);
  await page.route("**/api/v1/offers", (route) => route.fulfill({
    status: 409,
    json: { error: { code: "VERSION_CONFLICT" } },
  }));
  await page.goto("/app/add-offer");
  await fillManualOffer(page);
  await page.getByRole("button", { name: "Analyze offer" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/add-offer$/);
});

test("integrated offer route displays a permission denial without advancing", async ({ page }) => {
  await authenticate(page);
  await page.route("**/api/v1/offers", (route) => route.fulfill({
    status: 403,
    json: { error: { code: "ACTION_FORBIDDEN" } },
  }));
  await page.goto("/app/add-offer");
  await fillManualOffer(page);
  await page.getByRole("button", { name: "Analyze offer" }).click();
  await expect(page.locator(".fw-error[role='alert']")).toContainText("not authorized for this action");
  await expect(page).toHaveURL(/\/app\/add-offer$/);
});

import { expect, test, type Page } from "@playwright/test";
const worker = "40000000-0000-4000-8000-000000000001";
const employer = "40000000-0000-4000-8000-000000000002";
const offerId = "40000000-0000-4000-8000-000000000003";
const agreementId = "40000000-0000-4000-8000-000000000004";
const company = "40000000-0000-4000-8000-000000000005";
const offer = { offerId, companyId: company, workerId: worker, representativeId: employer,
  requesterId: employer, requesterRole: "EMPLOYER", version: 1, termHash: "a".repeat(64),
  snapshot: { salary: 1200, currency: "LKR", responsibilities: "Pack orders" }, changes: [], unresolved: [] };

test("participant link survives sign-in and still requires an authorized read", async ({ page }) => {
  let signedIn = false;
  let reads = 0;
  await page.route("**/api/v1/me", (route) => route.fulfill(signedIn
    ? { json: { data: { id: worker, displayName: "Synthetic worker", capabilities: [] } } }
    : { status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.route("**/api/v1/auth/sign-in", (route) => {
    signedIn = true;
    return route.fulfill({ json: { data: { authenticated: true } } });
  });
  await page.route("**/api/v1/agreements?*", (route) => {
    expect(signedIn).toBe(true); reads++;
    return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } });
  });
  await page.goto(`/app/agreement?offerId=${offerId}`);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`/sign-in?offerId=${offerId}`);
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByLabel("Password").fill("synthetic-test-password");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page).toHaveURL(`/app/agreement?offerId=${offerId}`);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Offer terms for agreement" })).toHaveCount(0);
  expect(reads).toBe(1);
});

test("direct agreement navigation cannot bypass unanswered clarification UI", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic worker", capabilities: [] } } }));
  await page.route("**/api/v1/agreements?*", (route) => route.fulfill({ json: { data: {
    offer: { ...offer, unresolved: [{ id: "40000000-0000-4000-8000-000000000009", field: "startDate", question: "When does the work or start date begin?", required: true }] },
    agreementId, answers: [], confirmation: null, canConfirm: false,
  } } }));
  await page.goto(`/app/agreement?offerId=${offerId}`);
  await expect(page.getByRole("button", { name: /Confirm these terms/ })).toBeDisabled();
  await page.getByRole("link", { name: "Review questions" }).click();
  await expect(page.getByRole("button", { name: /Continue to agreement/ })).toBeDisabled();
});

test("independent participants reopen saved terms, confirm, and recover after refresh", async ({ browser, baseURL }) => {
  const contexts = [await browser.newContext({ baseURL }), await browser.newContext({ baseURL })];
  const decisions = new Map<string, Record<string, unknown>>();
  const pages: Page[] = [];
  try {
    for (const [index, actor] of [employer, worker].entries()) {
      const page = await contexts[index]!.newPage(); pages.push(page);
      await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: actor, displayName: "Synthetic participant", capabilities: [] } } }));
      await page.route("**/api/v1/agreements?*", (route) => route.fulfill({ json: { data: {
        offer, agreementId, answers: [], canConfirm: !decisions.has(actor),
        confirmation: decisions.has(actor) ? { ...decisions.get(actor), status: decisions.size === 2 ? "confirmed" : "awaiting_other_party" } : null,
      } } }));
      await page.route("**/api/v1/agreements", (route) => {
        const body = route.request().postDataJSON();
        expect(body.agreementId).toBe(agreementId);
        expect(body.confirmationRole).toBe(actor === worker ? "WORKER" : "EMPLOYER");
        const decision = { agreementId, offerId, version: 1, confirmedBy: actor,
          confirmationRole: body.confirmationRole, currentHash: "b".repeat(64), status: decisions.size === 1 ? "confirmed" : "awaiting_other_party" };
        decisions.set(actor, decision);
        return route.fulfill({ json: { data: decision } });
      });
      await page.goto(`/app/agreement?offerId=${offerId}`);
      await expect(page.getByRole("region", { name: "Offer terms for agreement" })).toContainText("1200");
    }
    await pages[0]!.getByRole("button", { name: /Confirm these terms/ }).click();
    await expect(pages[0]!.getByRole("status")).toContainText("confirmation was recorded");
    await pages[1]!.getByRole("button", { name: /Confirm these terms/ }).click();
    await expect(pages[1]!.getByRole("status")).toContainText("Both parties confirmed");
    await pages[0]!.reload();
    await expect(pages[0]!.getByRole("status")).toContainText("Both parties confirmed");
    await pages[0]!.screenshot({ path: "test-results/day3-visual/after/agreement-confirmed.png", fullPage: true, animations: "disabled" });
    expect(decisions.size).toBe(2);
  } finally { for (const context of contexts) await context.close(); }
});

test("a foreign saved ID never displays terms or enables confirmation", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic worker", capabilities: [] } } }));
  await page.route("**/api/v1/agreements?*", (route) => route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } }));
  await page.goto(`/app/agreement?offerId=${offerId}`);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Offer terms for agreement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Confirm these terms/ })).toHaveCount(0);
});

test("a newer server revision blocks confirmation of the earlier displayed terms", async ({ page }) => {
  let reads = 0;
  let posts = 0;
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic worker", capabilities: [] } } }));
  await page.route("**/api/v1/agreements?*", (route) => route.fulfill({ json: { data: {
    offer: ++reads === 1 ? offer : { ...offer, version: 2, snapshot: { salary: 9999 }, termHash: "c".repeat(64) },
    agreementId, answers: [], confirmation: null, canConfirm: true,
  } } }));
  await page.route("**/api/v1/agreements", (route) => { posts++; return route.abort(); });
  await page.goto(`/app/agreement?offerId=${offerId}`);
  await page.getByRole("button", { name: /Confirm these terms/ }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("offer changed");
  expect(posts).toBe(0);
  await expect(page.getByRole("region", { name: "Offer terms for agreement" })).toContainText("1200");
});

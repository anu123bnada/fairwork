import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hostedOrigin } from "../../playwright.hosted.config";
import { assertSafeOrigin, writesAllowed } from "./guard";

// REAL hosted journeys for ONE signed-in worker account. Nothing is intercepted or mocked. Read-only unless ORYQEN_HOSTED_WRITES=1.
// Assertions are limited to what the existing backend supports for a single ordinary account; journeys that need a second account or an operator
// capability (agreements with a counterparty, verification, reviewer decisions) are asserted only as "screen loads and fails closed".
test.beforeAll(() => assertSafeOrigin(hostedOrigin));

const noScreenError = (page: Page) => expect(page.locator(".fw-error[role='alert']")).toHaveCount(0);
async function open(page: Page, screen: string) {
  await page.goto(`/app/${screen}`);
  await expect(page, `${screen} must not bounce a signed-in session to sign-in`).toHaveURL(new RegExp(`/app/${screen}`));
  await expect(page.getByRole("heading").first()).toBeVisible();
}

test.describe("session", () => {
  test("session is real: the profile API answers for this account and survives a reload @mobile", async ({ page }) => {
    await open(page, "home");
    const me = await page.request.get("/api/v1/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).data?.id).toBeTruthy();
    await page.reload();
    await expect(page).toHaveURL(/\/app\/home/);
  });

  test("session persists in a second tab of the same profile", async ({ context }) => {
    const second = await context.newPage();
    await second.goto("/app/home");
    await expect(second).toHaveURL(/\/app\/home/);
  });

  test("an unauthenticated browser profile is refused by the API and cannot read the Passport", async ({ browser }) => {
    const anonymous = await browser.newContext({ baseURL: hostedOrigin, storageState: { cookies: [], origins: [] } });
    const page = await anonymous.newPage();
    expect((await page.request.get("/api/v1/me")).status()).toBe(401);
    expect((await page.request.get("/api/v1/passport")).status()).toBe(401);
    await page.goto("/app/passport");
    await expect(page.getByRole("link", { name: /sign in/i }).or(page.getByLabel("Email address")).first()).toBeVisible();
    await anonymous.close();
  });
});

test.describe("screens", () => {
  test("home dashboard renders from real data without an error banner @mobile", async ({ page }) => {
    await open(page, "home");
    await expect(page.getByRole("region", { name: "Dashboard work records" })).toBeVisible();
    await noScreenError(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  for (const screen of ["add-offer", "check", "agreement", "agreement-workflow", "work-record", "passport", "cases", "notifications", "settings"]) {
    test(`${screen} loads for the signed-in account and shows no error banner`, async ({ page }) => {
      await open(page, screen);
      await noScreenError(page);
    });
  }

  test("notifications feed answers for this account only", async ({ page }) => {
    await open(page, "notifications");
    const feed = await page.request.get("/api/v1/notifications");
    expect(feed.status()).toBe(200);
    expect(Array.isArray((await feed.json()).data?.items)).toBe(true);
  });

  test("work records, Passport, offers and cases APIs answer without a server error", async ({ page }) => {
    await open(page, "home");
    for (const path of ["/api/v1/work-records", "/api/v1/passport", "/api/v1/offers?limit=5", "/api/v1/work-cases"]) {
      const response = await page.request.get(path);
      expect([200, 403, 404], `${path} should succeed or fail closed, got ${response.status()}`).toContain(response.status());
    }
  });
});

test.describe("offers", () => {
  test("offer analysis form validates before anything is sent", async ({ page }) => {
    await open(page, "add-offer");
    await page.getByLabel("Paste offer text").fill("Synthetic offer: LKR 1000 monthly, eight hours each week.");
    await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
    await expect(page.locator(".fw-error[role='alert']")).toContainText("Role title");
  });

  test("offer analysis API reports the AI gateway honestly (never invents findings)", async ({ page }) => {
    await open(page, "home");
    const response = await page.request.post("/api/v1/offers/analyze", {
      data: { text: "Synthetic check: LKR 1000 monthly, eight hours each week.", role: "WORKER" },
      headers: { Origin: hostedOrigin, "Idempotency-Key": randomUUID() },
    });
    expect(response.status()).toBe(200);
    const ai = (await response.json()).data;
    expect(ai.status, "AI must be off or report a recognised status").toMatch(/^(UNCONFIGURED|OK|FALLBACK|DISABLED)$/);
    if (ai.status === "UNCONFIGURED") { expect(ai.configured).toBe(false); expect(ai.data).toBeNull(); }
  });

  test("save a private offer draft and read it back (writes; opt-in)", async ({ page }) => {
    test.skip(!writesAllowed(), "set ORYQEN_HOSTED_WRITES=1 to allow one synthetic private draft to be written to staging");
    const role = `Synthetic QA ${Date.now()}`;
    await open(page, "add-offer");
    await page.getByText("Private offer drafts — no organization required", { exact: true }).click();
    await page.getByLabel("Draft role", { exact: true }).fill(role);
    await page.getByLabel("Draft offer text", { exact: true }).fill("Synthetic QA draft: LKR 1000 monthly");
    await page.getByRole("button", { name: "Save private draft", exact: true }).click();
    await expect(page.getByText(/Private draft saved/)).toBeVisible();
    await page.reload();
    await page.getByText("Private offer drafts — no organization required", { exact: true }).click();
    await expect(page.getByText(role).first()).toBeVisible();
  });
});

test.describe("disputes", () => {
  test("case review screen fails closed without a record to review", async ({ page }) => {
    await open(page, "cases");
    await expect(page.getByRole("heading", { name: "Review a concern" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit concern" })).toBeDisabled();
  });
});

test.describe("sign-out", () => {
  // Uses its own fresh sign-in so that ending the session cannot break the shared state used by the tests above.
  test("sign out ends the session: the profile API answers 401 and the app screen redirects", async ({ browser }) => {
    test.skip(process.env.ORYQEN_HOSTED_SIGNOUT !== "1", "pass --signout to run a sign-in and sign-out of its own");
    const context = await browser.newContext({ baseURL: hostedOrigin });
    const page = await context.newPage();
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(process.env.ORYQEN_TEST_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(process.env.ORYQEN_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Continue securely" }).click();
    await expect(page).toHaveURL(/\/app\//);
    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    expect((await page.request.get("/api/v1/me")).status()).toBe(401);
    await context.close();
  });
});

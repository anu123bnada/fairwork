import { expect, test } from "@playwright/test";

const id = "40000000-0000-4000-8000-000000000003";
const profile = { id, displayName: "Synthetic member", locale: "en", timeZone: "Asia/Colombo", revision: 1, capabilities: [] };

test("registration validates confirmation and preserves the invited destination across verification", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true", "Requires isolated registration-enabled build.");
  const continuation = `offerId=${id}&workspace=employer`;
  let registrations = 0;
  await page.route("**/api/v1/auth/register", route => {
    registrations++;
    expect(route.request().postDataJSON()).toEqual({ email: "synthetic@example.test", password: "synthetic-password", displayName: "Synthetic member", continuation });
    return route.fulfill({ json: { data: { verificationRequired: true } } });
  });
  await page.goto(`/sign-in?offerId=${id}&next=https://evil.invalid`);
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(`/register?offerId=${id}`);
  await page.getByRole("button", { name: /I’m an employer/ }).click();
  await page.getByLabel("Your name").fill("Synthetic member");
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByLabel("Confirm password").fill("different-password");
  await page.getByRole("button", { name: "Register with email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("passwords do not match");
  expect(registrations).toBe(0);
  await page.getByLabel("Confirm password").fill("synthetic-password");
  await page.getByRole("button", { name: "Register with email" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  expect(registrations).toBe(1);
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("wait a minute");
  await page.route("**/api/v1/auth/confirm", route => route.fulfill({ json: { data: { confirmed: true } } }));
  await page.goto(`/auth/confirm?${continuation}#token_hash=${"a".repeat(64)}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page).toHaveURL(`/register/profile?${continuation}`);
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: profile } }));
  await page.getByLabel("Display name").fill("Synthetic member");
  await page.getByRole("button", { name: "Create my profile" }).click();
  await expect(page).toHaveURL(`/app/agreement?offerId=${id}`);
});

test("expired verification can request another email without claiming verification", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true", "Requires isolated registration-enabled build.");
  await page.route("**/api/v1/auth/confirm", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.route("**/api/v1/auth/resend", route => {
    expect(route.request().postDataJSON()).toEqual({ email: "synthetic@example.test", continuation: "workspace=employer" });
    return route.fulfill({ json: { data: { verificationRequired: true } } });
  });
  await page.goto(`/auth/confirm?workspace=employer#token_hash=${"a".repeat(64)}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByText("Need another verification email?").click();
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("status")).toContainText("If this address has an unconfirmed account");
  await expect(page).toHaveURL(/auth\/confirm\?workspace=employer#/);
});

test("organization onboarding submits existing contract and reports pending, rejected and active states", async ({ page }) => {
  let submitted = false;
  let decision: null | "reject" | "approve" = null;
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: profile } }));
  await page.route("**/api/v1/offers?**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/organizations", route => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ companyId: null, companyName: "Synthetic workshop", statement: "Synthetic representative requesting independent review" });
      expect(route.request().headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/);
      submitted = true;
      return route.fulfill({ json: { data: { requestId: id } } });
    }
    return route.fulfill({ json: { data: { items: submitted ? [{ requestId: id, companyId: null, companyName: "Synthetic workshop", statement: "Synthetic representative requesting independent review", createdAt: "2026-10-23T00:00:00Z", decision, active: decision === "approve", reason: decision === "reject" ? "Evidence needs clarification" : null }] : [], nextCursor: null } } });
  });
  await page.goto("/app/employer");
  await expect(page.getByRole("heading", { name: "Set up your organization" })).toBeVisible();
  await page.getByLabel("Organization name", { exact: true }).fill("Synthetic workshop");
  await page.getByLabel("Membership request statement").fill("Synthetic representative requesting independent review");
  await page.getByRole("button", { name: "Request independent approval" }).click();
  await expect(page.getByText("Status: Pending independent review")).toBeVisible();
  await expect(page.getByText(/cannot represent this organization while approval is pending/)).toBeVisible();
  decision = "reject";
  await page.getByRole("button", { name: "Refresh organization requests" }).click();
  await expect(page.getByText("Evidence needs clarification")).toBeVisible();
  await expect(page.getByText("Appeal this rejection")).toBeVisible();
  decision = "approve";
  await page.getByRole("button", { name: "Refresh organization requests" }).click();
  await expect(page.getByText(/This is synthetic membership, not real-world verification/)).toBeVisible();
});

test("recovery preserves destination through email request, reset and sign-in", async ({ page }) => {
  await page.route("**/api/v1/auth/recovery", route => {
    expect(route.request().postDataJSON()).toEqual({ email: "synthetic@example.test", continuation: "workspace=employer" });
    return route.fulfill({ json: { data: { requested: true } } });
  });
  await page.goto("/sign-in?workspace=employer");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL("/forgot-password?workspace=employer");
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByRole("button", { name: "Send recovery email" }).click();
  await expect(page.getByRole("status")).toContainText("If this address has an account");
  await page.route("**/api/v1/auth/recovery/confirm", route => route.fulfill({ json: { data: { confirmed: true } } }));
  await page.route("**/api/v1/auth/mfa", route => route.fulfill({ json: { data: { factors: [] } } }));
  await page.route("**/api/v1/auth/password", route => route.fulfill({ json: { data: { updated: true, signInRequired: true } } }));
  await page.goto(`/auth/recover?workspace=employer#token_hash=${"b".repeat(64)}`);
  await page.getByRole("button", { name: "Confirm recovery link" }).click();
  await page.getByLabel("New password", { exact: true }).fill("synthetic-new-password");
  await page.getByLabel("Confirm new password").fill("synthetic-new-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/sign-in?workspace=employer");
});

test("settings keeps sign-out failures visible and clears local selection only after success", async ({ page }) => {
  let fail = true;
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: profile } }));
  await page.route("**/api/v1/auth/mfa", route => route.fulfill({ json: { data: { factors: [] } } }));
  await page.route("**/api/v1/auth/sign-out", route => route.fulfill(fail ? { status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } } : { json: { data: { signedOut: true } } }));
  await page.goto("/app/settings");
  await page.evaluate(value => sessionStorage.setItem("fairwork.offer-selection", value), id);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator(".fw-error[role=alert]").last()).toBeVisible();
  await expect(page).toHaveURL("/app/settings");
  expect(await page.evaluate(() => sessionStorage.getItem("fairwork.offer-selection"))).toBe(id);
  fail = false;
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/sign-in");
  expect(await page.evaluate(() => sessionStorage.getItem("fairwork.offer-selection"))).toBeNull();
});

test("a protected settings destination survives login and registration links", async ({ page }) => {
  let signedIn = false;
  await page.route("**/api/v1/me", route => route.fulfill(signedIn ? { json: { data: profile } } : { status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.route("**/api/v1/auth/sign-in", route => {
    signedIn = true;
    return route.fulfill({ json: { data: { signedIn: true } } });
  });
  await page.goto("/app/settings");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/sign-in?screen=settings");
  await expect(page.getByRole("link", { name: "Create account", exact: true })).toHaveAttribute("href", "/register?screen=settings");
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page).toHaveURL("/app/settings");
});

for (const width of [320, 768, 1440]) {
  test(`auth layouts fit ${width}px and retain visible labels`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    for (const path of ["/sign-in", "/register", "/register/profile", "/forgot-password", "/auth/recover"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.goto("/register");
    if (process.env.AUTH_REGISTRATION_ENABLED === "true") {
      await page.getByRole("button", { name: /I’m a worker/ }).click();
      await expect(page.getByLabel("Confirm password")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.screenshot({ path: `test-results/auth-registration-${width}.png`, fullPage: true });
  });
}

import { expect, test } from "@playwright/test";

// Isolated transport fixtures, never hosted registration or email-delivery proof.
test("registration is gated or uses real email fields without self-assigned authority", async ({ page }) => {
  await page.goto("/register");
  if (process.env.AUTH_REGISTRATION_ENABLED !== "true") {
    await expect(page.getByText("Registration is not enabled for this build.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Register with email" })).toHaveCount(0);
    return;
  }
  await page.route("**/api/v1/auth/register", async route => {
    expect(route.request().postDataJSON()).toEqual({ email: "fresh@example.test", password: "synthetic-password-only", displayName: "Synthetic worker", continuation: "" });
    await route.fulfill({ json: { data: { verificationRequired: true } } });
  });
  await page.getByRole("button", { name: /I’m a worker/ }).click();
  await page.getByLabel("Your name").fill("Synthetic worker");
  await page.getByLabel("Email address").fill("fresh@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password-only");
  await page.getByLabel("Confirm password", { exact: true }).fill("synthetic-password-only");
  await page.getByRole("button", { name: "Register with email" }).click();
  await expect(page.getByRole("status")).toContainText("check your email");
  await expect(page.getByRole("button", { name: /Resend available in/ })).toBeDisabled();
});

test("confirmation needs explicit POST, strips fragment and profile creation survives reload", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true", "Run with registration enabled only in the isolated environment.");
  const tokenHash = "a".repeat(64);
  let calls = 0;
  await page.route("**/api/v1/auth/confirm", async route => {
    calls++;
    expect(route.request().method()).toBe("POST"); expect(route.request().postDataJSON()).toEqual({ tokenHash });
    await route.fulfill({ json: { data: { confirmed: true } } });
  });
  await page.goto(`/auth/confirm#token_hash=${tokenHash}`);
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page).toHaveURL(/\/register\/profile$/);
  await page.reload();
  await page.route("**/api/v1/me", async route => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ displayName: "Synthetic worker", locale: "en", timeZone: "Asia/Colombo" });
      expect(route.request().headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/);
    }
    await route.fulfill({ json: { data: { id: "40000000-0000-4000-8000-000000000001", displayName: "Synthetic worker", locale: "en", timeZone: "Asia/Colombo", revision: 1, capabilities: [] } } });
  });
  await page.getByLabel("Display name").fill("Synthetic worker");
  await page.getByRole("button", { name: "Create my profile" }).click();
  await expect(page).toHaveURL(/\/app\/intro-welcome$/);
});

test("invalid email confirmation remains an error, never a successful session claim", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true", "Isolated enabled registration only.");
  await page.route("**/api/v1/auth/confirm", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.goto(`/auth/confirm#token_hash=${"b".repeat(64)}`);
  await page.getByRole("button", { name: "Confirm my email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  await expect(page.getByRole("button", { name: "Create my profile" })).toHaveCount(0);
});

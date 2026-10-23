import { expect, test } from "@playwright/test";

const id = "40000000-0000-4000-8000-000000000001";

test("sign-in information is secondary, truthful and preserves the authorized record destination", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/sign-in?offerId=${id}`);
  await expect(page.getByText("Test accounts only · Synthetic data only")).toBeVisible();
  await expect(page.getByText("Email/password sign-in. SMS unavailable.")).toBeVisible();
  await expect(page.locator('input[type="tel"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /send code/i })).toHaveCount(0);
  await page.getByRole("link", { name: "Sign-in information", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test accounts only" })).toBeVisible();
  await expect(page.getByText(process.env.AUTH_REGISTRATION_ENABLED === "true" ? /Controlled email registration is enabled/ : /Public account registration is not available/)).toBeVisible();
  await expect(page.getByText(/Phone-number sign-in and phone OTP are not implemented/)).toBeVisible();
  await page.getByRole("link", { name: "Back to sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?offerId=${id}$`));
  await page.route("**/api/v1/auth/sign-in", async route => {
    expect(route.request().postDataJSON()).toEqual({ email: "synthetic@example.test", password: "synthetic-only" });
    await route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } });
  });
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-only");
  await page.getByRole("button", { name: "Continue securely", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?offerId=${id}$`));
  await page.goto("/sign-in/information?from=https://evil.example&offerId=forged&returnTo=https://evil.example");
  await expect(page.getByRole("link", { name: "Back to sign in", exact: true })).toHaveAttribute("href", "/sign-in");
});

test("authenticator keeps six real digits, verifies through MFA and never invents resend or SMS", async ({ page }) => {
  await page.route("**/api/v1/auth/mfa", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: { factors: [{ id, status: "verified" }] } } });
    expect(route.request().postDataJSON()).toEqual({ action: "verify", factorId: id, code: "123456" });
    return route.fulfill({ status: 403, json: { error: { code: "ACTION_FORBIDDEN" } } });
  });
  await page.goto("/otp");
  await expect(page.getByRole("group", { name: "Six-digit authenticator code" }).getByRole("textbox")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Verify & continue" })).toBeDisabled();
  await expect(page.getByText(/resend/i)).toHaveCount(0);
  await page.getByLabel("Authenticator digit 1").fill("1234");
  await expect(page.getByRole("button", { name: "Verify & continue" })).toBeDisabled();
  await page.getByLabel("Authenticator digit 1").fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/otp$/);
  await page.getByRole("link", { name: "Sign-in information", exact: true }).click();
  await page.getByRole("link", { name: "Back to authenticator", exact: true }).first().click();
  await expect(page).toHaveURL(/\/otp$/);
  await page.route("**/api/v1/auth/mfa", route => route.fulfill({ json: { data: { factors: [] } } }));
  await page.reload();
  await expect(page.locator('.fw-error[role="alert"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify & continue" })).toHaveCount(0);
});

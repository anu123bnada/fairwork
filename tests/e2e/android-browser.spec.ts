import { devices, expect, test } from "@playwright/test";

// Android-shaped Chromium coverage, not an emulator or a native APK test.
test.use({ ...devices["Pixel 7"] });

test("mobile startup and real API transport fail closed without Supabase", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // "/" is the public cinematic landing page; startup begins at /intro/splash.
  await page.goto("/intro/splash");
  await expect(page).toHaveURL(/\/intro\/onboarding$/);
  await expect(page.getByRole("heading", { name: "See what’s clear" })).toBeVisible();
  await page.goto("/app/home");
  await expect(page.getByRole("heading", { name: "Secure service unavailable" })).toBeVisible();
  await page.screenshot({ path: "test-results/day3-visual/after/mobile-offline.png", fullPage: true, animations: "disabled" });
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/v1/me", { credentials: "same-origin", cache: "no-store" });
    return { status: result.status, cache: result.headers.get("cache-control"), body: await result.json() };
  });
  expect(response.status).toBe(503);
  expect(response.cache).toBe("private, no-store");
  expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("mobile synthetic login, route history, share dismissal and logout recovery", async ({ page }) => {
  let signedIn = false;
  await page.route("**/api/v1/me", route => route.fulfill(signedIn ? {
    json: { data: { id: "40000000-0000-4000-8000-000000000001", displayName: "Synthetic Worker", locale: "en", timeZone: "Asia/Colombo", revision: 1, capabilities: [] } },
  } : { status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.route("**/api/v1/auth/sign-in", route => {
    signedIn = true;
    return route.fulfill({ json: { data: { signedIn: true } } });
  });
  await page.route("**/api/v1/auth/sign-out", route => {
    signedIn = false;
    return route.fulfill({ json: { data: { signedOut: true } } });
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("android.synthetic@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-only-password");
  await page.getByRole("button", { name: "Continue securely", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/intro-welcome$/);
  await page.getByRole("link", { name: /Check a job offer/ }).click();
  await expect(page.getByRole("heading", { name: /Good morning, Synthetic/ })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Passport", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/passport$/);
  await page.getByRole("link", { name: "Share Work Passport", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/passport$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/home$/);
  await page.screenshot({ path: "test-results/android-mobile-home.png", fullPage: true });
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});

test("mobile private screens fail closed when the API network is offline", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.abort("internetdisconnected"));
  await page.goto("/app/home");
  await expect(page.getByRole("heading", { name: "Secure service unavailable" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add offer details" })).toHaveCount(0);
});

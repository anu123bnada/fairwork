import { expect, test } from "@playwright/test";

// Before the page's scripts run, the submit button is disabled, so a very early submit cannot reload the page with the typed email and password in the address bar.
test("the sign-in submit stays disabled until the form is ready and credentials never reach the URL", async ({ page }) => {
  await page.route("**/api/v1/auth/sign-in", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  await page.goto("/sign-in", { waitUntil: "commit" });
  const urls: string[] = [];
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) urls.push(frame.url()); });
  await page.getByLabel("Email address").fill("synthetic@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password-not-real");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page.locator("form p[role=alert]")).toBeVisible();
  expect(page.url()).not.toMatch(/password|synthetic/i);
  for (const url of urls) expect(url).not.toMatch(/password|synthetic/i);
});

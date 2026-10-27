import { expect, test } from "@playwright/test";
import { errorMessages } from "../../src/lib/errors";

// The two pages every visitor starts on. These check what a person actually SEES and can do, not just that the server answered 200.
for (const path of ["/", "/sign-in"]) {
  test(`${path} renders real content, never the "Page unavailable" view, and raises no page error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByText("Page unavailable")).toHaveCount(0);
    if (path === "/") await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    else { await expect(page.getByLabel("Email address")).toBeVisible(); await expect(page.getByRole("button", { name: "Continue securely" })).toBeVisible(); }
    expect(errors).toEqual([]);
  });
}

test("client-side navigation from the landing page to sign-in works and so does a reload there", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /sign in/i }).first().click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByText("Page unavailable")).toHaveCount(0);
});

for (const [status, code, expected] of [[401, "AUTH_REQUIRED", errorMessages.AUTH_REQUIRED], [403, "ACTION_FORBIDDEN", errorMessages.ACTION_FORBIDDEN], [403, "WRONG_ORIGIN", errorMessages.WRONG_ORIGIN], [503, "SERVICE_UNAVAILABLE", errorMessages.SERVICE_UNAVAILABLE]] as const) {
  test(`sign-in shows the right plain-language message for ${code}`, async ({ page }) => {
    await page.route("**/api/v1/auth/sign-in", route => route.fulfill({ status, json: { error: { code, message: expected } } }));
    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await page.getByLabel("Email address").fill("synthetic@example.test");
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password-1");
    await page.getByRole("button", { name: "Continue securely" }).click();
    await expect(page.locator("[role=alert]").filter({ hasText: expected })).toBeVisible();
    await expect(page.getByText("Page unavailable")).toHaveCount(0);
  });
}

test("a route that does not exist still shows the unavailable page with a way back", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByRole("heading", { name: "Page unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to ORYQEN" })).toBeVisible();
});

test("a signed-out visitor to a private screen is asked to sign in, not shown an error", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED", message: errorMessages.AUTH_REQUIRED } } }));
  await page.goto("/app/home", { waitUntil: "networkidle" });
  await expect(page.getByText("Sign in to continue")).toBeVisible();
  await expect(page.getByText("Page unavailable")).toHaveCount(0);
});

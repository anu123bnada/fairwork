import { expect, test } from "@playwright/test";

test("Back leaves a captured confirmation callback without rewriting the destination", async ({ page }) => {
  test.skip(process.env.AUTH_REGISTRATION_ENABLED !== "true");
  await page.goto("/sign-in?workspace=employer");
  await page.goto(`/auth/confirm?workspace=employer#token_hash=${"a".repeat(64)}`);
  await expect(page).toHaveURL("/auth/confirm?workspace=employer");
  await expect(page.getByRole("button", { name: "Confirm my email" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/sign-in?workspace=employer");
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(page.url()).not.toContain("token_hash");
});

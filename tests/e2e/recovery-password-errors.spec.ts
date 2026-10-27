import { expect, test } from "@playwright/test";
import { errorMessages } from "../../src/lib/errors";
import { translate } from "../../src/i18n";

const jwt = `${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(24)}`;
const link = `#access_token=${jwt}&expires_in=3600&refresh_token=refreshTOKEN123&token_type=bearer&type=recovery`;
async function atPasswordStep(page: import("@playwright/test").Page, passwordStatus: number, code: string) {
  await page.route("**/api/v1/auth/recovery/confirm", route => route.fulfill({ json: { data: { confirmed: true } } }));
  await page.route("**/api/v1/auth/mfa", route => route.fulfill({ json: { data: { factors: [] } } }));
  await page.route("**/api/v1/auth/password", route => route.fulfill({ status: passwordStatus, json: { error: { code, message: (errorMessages as Record<string, string>)[code] } } }));
  await page.goto(`/auth/recover${link}`);
  await page.getByRole("button", { name: "Confirm recovery link" }).click();
  await page.getByLabel("New password", { exact: true }).fill("synthetic-new-password");
  await page.getByLabel("Confirm new password", { exact: true }).fill("synthetic-new-password");
  await page.getByRole("button", { name: "Save new password" }).click();
}

test("a password the provider refuses as identical to the current one is explained, never 'Check the supplied fields.', and the form stays open", async ({ page }) => {
  await atPasswordStep(page, 422, "SAME_PASSWORD");
  await expect(page.locator("[role=alert]").filter({ hasText: translate("en", "au.rec.samePassword") })).toBeVisible();
  await expect(page.getByText("Check the supplied fields.")).toHaveCount(0);
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
});
test("a password refused as too weak or too common is explained and the form stays open", async ({ page }) => {
  await atPasswordStep(page, 422, "WEAK_PASSWORD");
  await expect(page.locator("[role=alert]").filter({ hasText: translate("en", "au.rec.weakPassword") })).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
});
test("a reset session that ended before saving offers a new email instead of a dead form", async ({ page }) => {
  await atPasswordStep(page, 401, "RESET_EXPIRED");
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a new reset email" })).toHaveAttribute("href", "/forgot-password");
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
});
test("the password-refusal messages exist in every language", async () => {
  for (const key of ["au.rec.samePassword", "au.rec.weakPassword"] as const) for (const locale of ["si", "ta", "de"] as const) expect(translate(locale, key)).not.toBe(translate("en", key));
});

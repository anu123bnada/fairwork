import { expect, test } from "@playwright/test";
import { translate } from "../../src/i18n";

// The chosen language is stored on the device, so it also applies before sign-in. Synthetic transport only.
for (const locale of ["si", "ta", "de"] as const) {
  test(`sign-in, registration and recovery follow the chosen language (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(value => window.localStorage.setItem("oryqen.locale", value), locale);
    await page.route("**/api/v1/**", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));

    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: translate(locale, "au.signInTitle") })).toBeVisible();
    await expect(page.getByLabel(translate(locale, "au.email"))).toBeVisible();
    await expect(page.getByRole("button", { name: translate(locale, "au.continueSecurely") })).toBeVisible();
    await expect(page.getByText(translate(locale, "au.signInSubtitle"))).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);

    if (process.env.AUTH_REGISTRATION_ENABLED === "true") { // the form is only served by a registration-enabled build
      await page.goto("/register");
      await expect(page.getByRole("heading", { name: translate(locale, "au.reg.howUse") })).toBeVisible();
      await page.getByRole("button", { name: new RegExp(translate(locale, "au.reg.worker")) }).click();
      await expect(page.getByLabel(translate(locale, "au.reg.yourName"))).toBeVisible();
      await page.getByLabel(translate(locale, "au.reg.yourName")).fill("Synthetic Person");
      await page.getByLabel(translate(locale, "au.email"), { exact: true }).fill("synthetic.person@example.test");
      await page.getByLabel(translate(locale, "au.password"), { exact: true }).fill("a long synthetic passphrase 1");
      await page.getByLabel(translate(locale, "au.reg.confirmPassword")).fill("a different synthetic passphrase");
      await page.getByRole("button", { name: translate(locale, "au.reg.submitRegister") }).click();
      await expect(page.locator("#registration-error")).toContainText(translate(locale, "au.reg.mismatch")); // translated, and still flagged as invalid
      await expect(page.getByLabel(translate(locale, "au.reg.confirmPassword"))).toHaveAttribute("aria-invalid", "true");

    }
    await page.goto("/forgot-password");
    await expect(page.getByRole("button", { name: translate(locale, "au.rec.send") })).toBeVisible();

    await expect(page.locator("body")).not.toContainText(/\bau\.[a-zA-Z.]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

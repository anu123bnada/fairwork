import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const destinations = ["home", "add-offer", "analyzing", "check", "questions", "agreement", "agreement-workflow", "work-record", "cases", "passport", "settings", "employer", "notifications", "share", "intro-welcome"];

test("pending branding never adds a guessed identity on direct product links or session failure states", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  for (const destination of destinations) {
    await page.goto(`/app/${destination}`);
    await expect(page.getByRole("heading", { name: "Sign in to continue", exact: true })).toBeVisible();
    await expect(page.locator("[data-oryqen-brand], .oq-brand-header")).toHaveCount(0);
    await expect(page.locator('img[src="/oryqen/mark.svg"], img[src="/figma/auth/shield.svg"]')).toHaveCount(0);
  }
  await page.route("**/api/v1/me", route => route.abort());
  await page.goto("/app/passport");
  await expect(page.getByRole("heading", { name: "Secure service unavailable" })).toBeVisible();
  await expect(page.locator(".oq-brand-header")).toHaveCount(0);
});

test("existing auth and onboarding composition stays unchanged on desktop/mobile and both OS themes", async ({ page }) => {
  mkdirSync("test-results/brand-infrastructure", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [390, 1280]) for (const colorScheme of ["light", "dark"] as const) {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const route of ["/sign-in", "/intro/onboarding", "/intro/language", "/sign-in/information"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("[data-oryqen-brand], .oq-brand-header")).toHaveCount(0);
      if (route === "/sign-in") {
        await expect(page.locator(".fw-auth-brand")).toHaveCSS("width", "113px");
        await expect(page.locator(".fw-auth-shield")).toHaveAttribute("src", "/figma/auth/shield.svg");
        await expect(page.getByLabel("Email address")).toBeVisible();
      } else await expect(page.locator('img[src="/figma/auth/shield.svg"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/brand-infrastructure/${width}-${colorScheme}-${route.replaceAll("/", "_")}.png`, fullPage: true, animations: "disabled" });
    }
  }
  expect(errors).toEqual([]);
});

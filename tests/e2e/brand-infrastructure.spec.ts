import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const destinations = ["home", "add-offer", "analyzing", "check", "questions", "agreement", "agreement-workflow", "work-record", "cases", "passport", "settings", "employer", "notifications", "share", "intro-welcome"];

test("only the owner-approved symbol is ever used as the brand on direct product links and session failure states", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }));
  for (const destination of destinations) {
    await page.goto(`/app/${destination}`);
    await expect(page.getByRole("heading", { name: "Sign in to continue", exact: true })).toBeVisible();
    await expect(page.locator('img[src="/oryqen/mark.svg"], img[src="/figma/auth/shield.svg"], img[src*="logo-glass"]')).toHaveCount(0);
    for (const art of await page.locator("[data-oryqen-brand]").all()) await expect(art).toHaveAttribute("src", "/oryqen/approved/oryqen-symbol.png");
  }
  await page.route("**/api/v1/me", route => route.abort());
  await page.goto("/app/passport");
  await expect(page.getByRole("heading", { name: "Secure service unavailable" })).toBeVisible();
  await expect(page.locator('img[src="/oryqen/mark.svg"], img[src="/figma/auth/shield.svg"]')).toHaveCount(0);
});

test("auth and onboarding composition holds on desktop/mobile and both OS themes with the approved symbol", async ({ page }) => {
  mkdirSync("test-results/brand-infrastructure", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [390, 1280]) for (const colorScheme of ["light", "dark"] as const) {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const route of ["/sign-in", "/intro/onboarding", "/intro/language", "/sign-in/information"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator('img[src="/figma/auth/shield.svg"], img[src="/oryqen/mark.svg"]')).toHaveCount(0);
      if (route === "/sign-in") {
        await expect(page.locator(".oq-brand-auth")).toHaveAttribute("src", "/oryqen/approved/oryqen-symbol.png");
        await expect(page.getByLabel("Email address")).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/brand-infrastructure/${width}-${colorScheme}-${route.replaceAll("/", "_")}.png`, fullPage: true, animations: "disabled" });
    }
  }
  expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const initial = { id: "40000000-0000-4000-8000-000000000001", displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] };
function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(channel => { const value = Number(channel) / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; });
    return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test("restored original artwork, glass, mobile proportions and motion survive client navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/intro/onboarding");
  await expect(page.locator(".fw-onboarding-art")).toHaveCSS("backdrop-filter", "blur(24px)");
  await expect(page.locator(".fw-onboarding-art")).toHaveCSS("animation-duration", "0.3s");
  await expect(page.locator(".fw-onboarding-art img")).toHaveAttribute("src", "/figma/product/00-onboarding-1-icon.svg");
  await expect(page.locator(".fw-onboarding-art img")).toHaveCSS("width", "108px");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ask with confidence" })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Build your Work Passport" })).toBeVisible();
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to ORYQEN" })).toBeVisible();
  // Global CSS persists across Next client navigation: auth must remain blue/glass.
  await page.goto("/sign-in");
  await expect(page.locator(".fw-auth")).toHaveCSS("background-image", /figma\/product\/background.svg/);
  await expect(page.locator(".fw-auth-brand")).toHaveCSS("width", "113px");
  await expect(page.getByLabel("Email address")).toHaveCSS("backdrop-filter", "blur(24px)");
  await page.goto("/intro/splash");
  await expect(page.locator(".fw-intro-logo img")).toHaveAttribute("src", "/figma/product/00-splash-icon.svg");
  await expect(page.locator(".fw-intro-logo")).toHaveCSS("animation-duration", "1.8s");
  await expect(page).toHaveURL(/\/intro\/onboarding$/);
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: initial } }));
  await page.goto("/app/notifications");
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Back", exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/home$/);
});

test("profile saves through PATCH with revision and idempotency, then survives reload", async ({ page }) => {
  let profile = { ...initial };
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/v1/me", async route => {
    if (route.request().method() === "PATCH") {
      payload = route.request().postDataJSON();
      expect(route.request().headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
      profile = { ...profile, displayName: String(payload?.displayName), timeZone: String(payload?.timeZone), revision: 2 };
    }
    await route.fulfill({ json: { data: profile } });
  });
  await page.goto("/app/settings");
  await page.getByLabel("Display name", { exact: true }).fill("Updated Synthetic Worker");
  await page.getByLabel("Time zone", { exact: true }).fill("Asia/Colombo");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  expect(payload).toEqual({ displayName: "Updated Synthetic Worker", timeZone: "Asia/Colombo", locale: "en", expectedRevision: 1 });
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Updated Synthetic Worker");
  await expect(page.getByRole("switch")).toHaveCount(0);
});

test("profile rejects invalid timezone, reports conflicts and reuses uncertain retry identity", async ({ page }) => {
  const keys: string[] = [];
  await page.route("**/api/v1/me", async route => {
    if (route.request().method() === "PATCH") {
      keys.push(route.request().headers()["idempotency-key"]!);
      return route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT" } } });
    }
    await route.fulfill({ json: { data: initial } });
  });
  await page.goto("/app/settings");
  await page.getByLabel("Time zone", { exact: true }).fill("not-a-zone");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("form", { name: "Edit profile" }).getByRole("alert")).toContainText("valid time zone");
  expect(keys).toHaveLength(0);
  await page.getByLabel("Time zone", { exact: true }).fill("UTC");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("form", { name: "Edit profile" }).getByRole("alert")).toContainText("Reload before trying again");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).toBe(keys[0]);
  await expect(page.getByText("Profile saved.")).toHaveCount(0);
});

test("ORYQEN metadata and restored icons survive reload; rejected dark preference cannot override original design", async ({ page, request }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveTitle(/ORYQEN/);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => localStorage.setItem("oryqen.appearance", "dark"));
  await page.reload();
  await expect(page.getByLabel("Appearance", { exact: false })).toHaveCount(0);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await expect(page.locator(".fw-auth-aside")).toBeVisible();
  await expect(page.locator(".fw-auth-content")).toHaveCSS("max-width", "440px");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".fw-auth-aside")).toBeHidden();
  await expect(page.locator(".fw-auth")).toHaveCSS("width", "390px");
  await expect(page.locator(".fw-auth-brand img").first()).toHaveAttribute("src", "/figma/auth/logo-glass.svg");
  // Optional old device preference is preserved, but no unapproved dark theme is applied.
  expect(await page.evaluate(() => localStorage.getItem("oryqen.appearance"))).toBe("dark");
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).name).toBe("ORYQEN");
  const response = await request.get("/sign-in");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  for (const path of ["/figma/auth/shield.svg", "/oryqen/restored-icon-192.png", "/oryqen/restored-icon-512.png", "/oryqen/restored-icon-180.png"]) expect((await request.get(path)).status()).toBe(200);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/intro/onboarding");
  await expect(page.locator(".fw-onboarding-art")).toHaveCSS("animation-name", "none");
});

test("original visual system remains readable on light and dark devices at mobile, tablet and desktop widths", async ({ page }) => {
  test.slow();
  mkdirSync("test-results/oryqen-restored-browser", { recursive: true });
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: initial } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/sign-in");
      for (const route of ["/sign-in", "/intro/onboarding", "/app/settings", "/app/cases"]) {
        await page.goto(route);
        if (route === "/app/cases") await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
        if (route === "/app/settings") await expect(page.getByRole("form", { name: "Edit profile" })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        if (route === "/sign-in") {
          for (const selector of [".fw-sign-in-notice", ".fw-auth form button"]) {
            const colors = await page.locator(selector).evaluate(element => { const style = getComputedStyle(element); return { color: style.color, background: style.backgroundColor, gradient: style.backgroundImage }; });
            const stops = colors.gradient.match(/rgb\([^)]+\)/g);
            // Buttons must pass against every actual gradient stop, not transparent black.
            // The compact notice has no panel. Use a conservative darker-blue
            // substrate than the original exported background beneath this text.
            for (const background of stops ?? ["rgb(181,197,255)"]) expect(contrast(colors.color, background)).toBeGreaterThanOrEqual(4.5);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const unnamed = await page.locator("input:not([type=hidden]),select,textarea").evaluateAll(elements => elements.filter(element => !(element as HTMLInputElement).labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby")).length);
        expect(unnamed).toBe(0);
        await page.screenshot({ path: `test-results/oryqen-restored-browser/${width}-${theme}-${route.replaceAll("/", "_")}.png`, fullPage: true, animations: "disabled" });
      }
    }
  }
  expect(errors).toEqual([]);
});

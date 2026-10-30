import { expect, test } from "@playwright/test";

// The V6 cinematic landing page is the public entry point at "/". Product
// screens remain on their existing routes (/sign-in, /register, /downloads, /app).
test("cinematic landing page is the public entry point with truthful release controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("OPPORTUNITY");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("REIMAGINED");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

  // Account entry points stay on the existing product routes.
  await expect(page.getByRole("link", { name: /SIGN IN/ })).toHaveAttribute("href", "/sign-in");
  await expect(page.locator(".download-account a", { hasText: "create one" })).toHaveAttribute("href", "/register");

  // Release controls are truthful: no fabricated binary URLs are exposed.
  const download = page.locator("#download");
  await expect(download.getByRole("link", { name: /RELEASE DETAILS & CHECKSUMS/ })).toHaveAttribute("href", "/downloads");
  // Both links point to published testing previews; signing disclosures remain visible.
  await expect(download.locator("a[href$='.apk']")).toHaveAttribute("href", "/downloads/ORYQEN-Online-Preview-1.0.0-staging-debug.apk");
  await expect(download.locator("a[href$='.exe']")).toHaveAttribute("href", "https://github.com/anu123bnada/fairwork/releases/download/oryqen-preview-v0.1.0/ORYQEN-Preview-0.1.0-x64-Setup.exe");
  await expect(download).toContainText(/unsigned/i);
  await expect(download).toContainText(/debug/i);
});

test("landing page is responsive without horizontal overflow", async ({ page }) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `horizontal overflow at ${width}px`,
    ).toBe(true);
  }
});

test("landing page navigates to downloads and back to sign-in", async ({ page }) => {
  await page.goto("/");
  await page.locator("#download").getByRole("link", { name: /RELEASE DETAILS & CHECKSUMS/ }).click();
  await expect(page).toHaveURL(/\/downloads$/);
  await expect(page.getByRole("heading", { name: "ORYQEN applications" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download Windows", exact: true })).toHaveAttribute("href", /github\.com\/anu123bnada\/fairwork\/releases\/download\//);
  await expect(page.getByRole("link", { name: "Download Android", exact: true })).toHaveAttribute("href", /\.apk$/);

  await page.goto("/");
  await page.getByRole("link", { name: /SIGN IN/ }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

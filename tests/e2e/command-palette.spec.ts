import { expect, test } from "@playwright/test";
import { setup } from "./support/records-fake";

test("command palette: opens with Ctrl K, filters as you type, moves with the arrow keys, opens the chosen feature, and closes with Escape", async ({ page }) => {
  await setup(page, []);
  await page.goto("/app/applications");
  await expect(page.getByRole("button", { name: "Add an application" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Go to a feature" })).toHaveCount(0);

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Go to a feature" });
  await expect(palette).toBeVisible();
  const input = palette.getByRole("combobox");
  await expect(input).toBeFocused();
  const options = palette.getByRole("option");
  expect(await options.count()).toBeGreaterThan(20);

  await input.fill("sal");
  await expect(options.first()).toContainText("Salary comparison");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await input.fill("zzzz");
  await expect(palette.getByText("Nothing matches. Try a different word.")).toBeVisible();
  await expect(options).toHaveCount(0);

  await input.fill("career");
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);

  await page.keyboard.press("Control+k");
  await page.getByRole("dialog", { name: "Go to a feature" }).getByRole("combobox").fill("interviews");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/interviews$/);
  await expect(page.getByRole("dialog", { name: "Go to a feature" })).toHaveCount(0);
});

test("command palette: opens from the sidebar and header buttons, a click opens a feature, and clicking outside closes it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setup(page, []);
  await page.goto("/app/workroom");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Search/ }).click();
  const palette = page.getByRole("dialog", { name: "Go to a feature" });
  await expect(palette).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(palette).toHaveCount(0);

  await page.getByRole("button", { name: "Search and jump to a feature" }).click();
  await expect(palette).toBeVisible();
  await palette.getByRole("option", { name: /Portfolio/ }).click();
  await expect(page).toHaveURL(/\/app\/portfolio$/);
});

test("command palette works on a phone from the Search item in the bottom navigation, and the header keeps its title clear", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, []);
  await page.goto("/app/workroom");
  await expect(page.getByRole("button", { name: "Search and jump to a feature" })).toBeHidden();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Search/ }).click();
  const palette = page.getByRole("dialog", { name: "Go to a feature" });
  await expect(palette).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await palette.getByRole("combobox").fill("demo");
  await palette.getByRole("option", { name: /Demo center/ }).click();
  await expect(page).toHaveURL(/\/app\/demo$/);
});

test("motion: screens animate in by default and not at all when the person asks for reduced motion", async ({ page }) => {
  await setup(page, []);
  await page.goto("/app/workroom");
  const section = page.locator(".fw-product-body > section").first();
  await expect(section).toBeVisible();
  expect(await section.evaluate(node => getComputedStyle(node).animationName)).toBe("oq-rise");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const still = page.locator(".fw-product-body > section").first();
  await expect(still).toBeVisible();
  expect(await still.evaluate(node => getComputedStyle(node).animationName)).toBe("none");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Go to a feature" });
  await expect(palette).toBeVisible();
  expect(await palette.evaluate(node => getComputedStyle(node).animationName)).toBe("none");
});

test("the session check shows a branded loader with its status text while it waits", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/me", async route => { await gate; await route.fulfill({ json: { data: { id: "40000000-0000-4000-8000-000000000001", displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }); });
  await page.route(/\/api\/v1\/records(\?.*)?$/, route => route.fulfill({ json: { data: { limit: 100, items: [] } } }));
  await page.goto("/app/workroom");
  await expect(page.getByRole("status").filter({ hasText: "Loading your private ORYQEN session" })).toBeVisible();
  await expect(page.locator(".oq-loader .oq-loader-orb")).toBeVisible();
  await expect(page.locator(".oq-loader .oq-skeleton span")).toHaveCount(4);
  release();
  await expect(page.getByRole("button", { name: "Add a project" })).toBeVisible();
  await expect(page.locator(".oq-loader")).toHaveCount(0);
});

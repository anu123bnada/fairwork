import { expect, test } from "@playwright/test";
import { setup } from "./support/records-fake";

// Phone-width check for the screens added this week: no horizontal page scroll and the main heading or region is visible. It checks layout only, not behaviour.
test.use({ viewport: { width: 375, height: 812 } });
const screens = ["applications", "workroom", "cover-letter", "portfolio", "career-explorer", "career-assistant", "employers-demo", "interviews", "applicants", "demo", "salary"];

for (const screen of screens) {
  test(`phone layout: /app/${screen} has no horizontal scroll`, async ({ page }) => {
    await setup(page, []);
    await page.route("**/api/v1/cv**", route => route.fulfill({ json: { data: { items: [], limit: 20 } } }));
    await page.goto(`/app/${screen}`);
    await page.locator("main, [role=main], section").first().waitFor();
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(overflow.scroll, `scrollWidth ${overflow.scroll} vs ${overflow.inner}`).toBeLessThanOrEqual(overflow.inner + 1);
  });
}

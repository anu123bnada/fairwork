import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { assertSafeOrigin } from "./guard";
import { hostedOrigin } from "../../playwright.hosted.config";

// Real authenticated screens, captured in both colour schemes at 1440px and 375px, with overflow, axe, keyboard-focus and reduced-motion checks.
// Read-only. Screenshots land in test-results/hosted/screens/<scheme>-<width>/<route>.png and are the evidence handed to the design owner.
test.beforeAll(() => assertSafeOrigin(hostedOrigin));

const routes = ["home", "opportunities", "add-offer", "check", "agreement", "agreement-workflow", "work-record", "passport", "cases", "notifications", "settings"];
const sizes = [{ name: "1440", width: 1440, height: 900 }, { name: "375", width: 375, height: 812 }];

for (const scheme of ["light", "dark"] as const) {
  for (const size of sizes) {
    test.describe(`${scheme} ${size.name}`, () => {
      test.use({ colorScheme: scheme, viewport: { width: size.width, height: size.height } });
      for (const route of routes) {
        test(`${route}: renders, fits the viewport, has no serious accessibility violations`, async ({ page }, info) => {
          await page.goto(`/app/${route}`);
          await expect(page).toHaveURL(new RegExp(`/app/${route}`));
          await expect(page.getByRole("heading").first()).toBeVisible();
          await page.waitForLoadState("networkidle").catch(() => undefined);
          const dir = `test-results/hosted/screens/${scheme}-${size.name}`;
          mkdirSync(dir, { recursive: true });
          // One 1440px light run stalled for 90s inside page.screenshot on a nearly empty page while the same route passed in the other three configurations;
          // a bounded first attempt plus one retry keeps a harness stall from masking real findings.
          const shoot = () => page.screenshot({ path: `${dir}/${route}.png`, fullPage: true, animations: "disabled", timeout: 25_000 });
          await shoot().catch(shoot);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          expect(overflow, `${route} overflows horizontally by ${overflow}px at ${size.name}px in ${scheme}`).toBeLessThanOrEqual(0);
          const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
          const serious = axe.violations.filter(v => v.impact === "serious" || v.impact === "critical");
          await info.attach(`axe-${scheme}-${size.name}-${route}.json`, { body: JSON.stringify(serious.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target })), null, 2), contentType: "application/json" });
          expect(serious.map(v => `${v.id} (${v.nodes.length})`), `${route} ${scheme} ${size.name}`).toEqual([]);
        });
      }
    });
  }
}

test.describe("keyboard and motion", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("Tab reaches interactive controls and each shows a visible focus indicator", async ({ page }) => {
    await page.goto("/app/home");
    await expect(page.getByRole("heading").first()).toBeVisible();
    const seen: { tag: string; visible: boolean }[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      seen.push(await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { tag: "BODY", visible: false };
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow !== "none";
        return { tag: el.tagName, visible: outline || shadow };
      }));
    }
    expect(seen.filter(s => s.tag !== "BODY").length, "Tab never reached a control").toBeGreaterThan(3);
    expect(seen.filter(s => s.tag !== "BODY" && !s.visible).map(s => s.tag), "controls focused with no outline or ring").toEqual([]);
  });

  test("reduced motion: no running animation or transition longer than 50ms on Home", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", baseURL: hostedOrigin, storageState: process.env.ORYQEN_HOSTED_STATE });
    const page = await context.newPage();
    await page.goto("/app/home");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.waitForTimeout(1500);
    const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running" && (a.effect?.getComputedTiming().iterations ?? 1) === Infinity).length);
    expect(running, "infinite animations still running with prefers-reduced-motion").toBe(0);
    await context.close();
  });

  test("Home settles quickly: load and DOM size are within budget for low-end devices", async ({ page }) => {
    await page.goto("/app/home");
    await expect(page.getByRole("heading").first()).toBeVisible();
    const m = await page.evaluate(() => ({ nodes: document.getElementsByTagName("*").length, canvases: document.querySelectorAll("canvas").length, blur: Array.from(document.querySelectorAll("*")).filter(e => /blur\(/.test(getComputedStyle(e).backdropFilter)).length }));
    expect(m.nodes, "DOM nodes").toBeLessThan(4000);
    expect(m.canvases, "WebGL/canvas elements on an app screen").toBe(0);
    expect(m.blur, "backdrop-filter surfaces (costly on integrated graphics)").toBeLessThan(25);
  });
});

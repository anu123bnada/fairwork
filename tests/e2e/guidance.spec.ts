import { expect, test } from "@playwright/test";
const id = "40000000-0000-4000-8000-000000000001";
for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) test(`private guidance ${width}px preserves history and does not claim AI or actions`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  let denied = false, threadId: string | null = null;
  const turns: unknown[] = [];
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/guidance**", route => {
    if (denied) return route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } });
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON(); threadId = body.threadId;
      turns.push({ ordinal: turns.length + 1, question: body.question, topic: body.topic, createdAt: "2026-10-24T00:00:00Z", response: { mode: "rules", text: "Save work notes privately first. Sharing is a separate explicit action.", source: "ORYQEN product guide", sourceVersion: "guidance.v1", destination: "/app/work-record", context: null } });
    }
    return route.fulfill({ json: { data: { threadId, turns, threads: threadId ? [{ id: threadId, updatedAt: "2026-10-24T00:00:00Z" }] : [], providerAvailable: false } } });
  });
  await page.goto("/app/guidance");
  const panel = page.getByRole("region", { name: "Private guidance" });
  await expect(panel.getByText(/Live AI guidance is unavailable/)).toBeVisible();
  await page.getByLabel("Guidance topic").selectOption("evidence");
  await page.getByLabel("Your question", { exact: true }).fill("How do I preserve work evidence?");
  await page.getByRole("button", { name: "Save question and get guidance" }).click();
  await expect(panel.getByText("No action has been taken on your behalf.")).toBeVisible();
  await page.reload(); await expect(panel.getByText("How do I preserve work evidence?", { exact: true })).toBeVisible();
  if ([390, 1440].includes(width)) await page.screenshot({ path: `test-results/guidance-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  denied = true; await page.getByRole("button", { name: "Reload conversation" }).click();
  await expect(panel.getByRole("alert")).toContainText("Sign in");
  await expect(panel.getByText("How do I preserve work evidence?", { exact: true })).toHaveCount(0);
});

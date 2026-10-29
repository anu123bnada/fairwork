import { expect, test } from "@playwright/test";

// Transport stand-ins shaped like the real API replies. They check that new activity appears without a reload and that a failed background refresh keeps what is shown; they are not evidence about the hosted service.
const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = (n: number, title: string) => ({ eventKey: `evt-${n}`, kind: "agreement_decision", title, message: "Synthetic message", recordedAt: `2026-10-29T0${n}:00:00Z`, read: false, href: "/app/employer" });

test("new notifications appear without a reload, and a failed refresh keeps the list and says it may be out of date", async ({ page }) => {
  let calls = 0, fail = false;
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/notifications", route => {
    calls += 1;
    if (fail) return route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } });
    return route.fulfill({ json: { data: { items: calls === 1 ? [item(1, "First reminder")] : [item(2, "Second reminder"), item(1, "First reminder")], nextCursor: null } } });
  });
  await page.goto("/app/notifications");
  await expect(page.getByText("First reminder")).toBeVisible();
  await expect(page.getByText("Second reminder")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("Second reminder")).toBeVisible();
  await expect(page.getByText("First reminder")).toBeVisible();
  fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("First reminder")).toBeVisible();
  await expect(page.getByText(/Could not check for new activity/)).toBeVisible();
});

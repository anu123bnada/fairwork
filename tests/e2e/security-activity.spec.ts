import { expect, test } from "@playwright/test";

const id = "40000000-0000-4000-8000-000000000001";
async function session(page: import("@playwright/test").Page, response: { status: number; json: unknown }, calls: string[] = []) {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic owner", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/security-events**", route => { calls.push(route.request().url()); return route.fulfill(response); });
}

test("security activity loads only when opened and lists the person's own events newest first", async ({ page }) => {
  const calls: string[] = [];
  await session(page, { status: 200, json: { data: { limit: 30, items: [
    { kind: "logout_success", occurredAt: "2026-11-03T10:00:00Z" }, { kind: "password_changed", occurredAt: "2026-11-02T09:00:00Z" },
    { kind: "mfa_success", occurredAt: "2026-11-01T08:00:20Z" }, { kind: "login_success", occurredAt: "2026-11-01T08:00:00Z" },
  ] } } }, calls);
  await page.goto("/app/settings");
  expect(calls).toHaveLength(0);
  await page.getByText("Security activity", { exact: true }).click();
  const list = page.getByRole("list", { name: "Security activity" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(list.getByRole("listitem").first()).toContainText("Signed out");
  await expect(list.getByRole("listitem").last()).toContainText("Signed in");
  await expect(list).toContainText("Password changed");
  await expect(list).toContainText("Second-factor check passed");
  expect(calls).toHaveLength(1);
  expect(new URL(calls[0]!).search).toBe("");
});

test("security activity says plainly when nothing is recorded and when it cannot be loaded", async ({ page }) => {
  await session(page, { status: 200, json: { data: { limit: 30, items: [] } } });
  await page.goto("/app/settings");
  await page.getByText("Security activity", { exact: true }).click();
  await expect(page.getByText("No security activity has been recorded for your account yet.")).toBeVisible();
  await page.unroute("**/api/v1/security-events**");
  await page.route("**/api/v1/security-events**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.getByRole("button", { name: "Reload security activity" }).click();
  await expect(page.getByText("Security activity is unavailable. Check your connection and retry.")).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("dashboard reloads persisted work, keeps references and recovers from read failures", async ({ page }) => {
  const id = "40000000-0000-4000-8000-000000000001";
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  let unavailable = false;
  await page.route("**/api/v1/work-records", route => unavailable
    ? route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } })
    : route.fulfill({ json: { data: { items: [{ workId: id, version: 1, state: "draft", hours: "16", periodStart: "2026-10-01", periodEnd: "2026-10-02" }], nextCursor: null } } }));
  await page.goto("/app/home");
  await page.getByRole("tab", { name: "Work records" }).click();
  const records = page.getByRole("region", { name: "Dashboard work records" });
  await expect(records).toContainText("16 hours · draft");
  await expect(records.getByRole("link", { name: "Open work record", exact: true })).toHaveAttribute("href", `/app/work-record?workId=${id}`);
  await page.reload();
  await page.getByRole("tab", { name: "Work records" }).click();
  await expect(records).toContainText("16 hours · draft");
  unavailable = true;
  await records.getByRole("button", { name: "Refresh work records" }).click();
  await expect(records.getByRole("alert")).toBeVisible();
  await expect(records.getByRole("link", { name: "Open work record", exact: true })).toHaveCount(0);
  unavailable = false;
  await records.getByRole("button", { name: "Refresh work records" }).click();
  await expect(records).toContainText("16 hours · draft");
  await page.setViewportSize({ width: 375, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

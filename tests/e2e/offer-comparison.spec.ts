import { expect, test } from "@playwright/test";
const ids = ["40000000-0000-4000-8000-000000000001", "40000000-0000-4000-8000-000000000002"];
for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
  test(`saved offer comparison at ${width}px uses authorized revisions and recovers from denied access`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: ids[0], displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
    await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: ids.map((offerId, index) => ({ offerId, companyId: ids[0], version: 1, role: `Role ${index + 1}`, createdAt: "2026-10-24", questions: 0 })), nextCursor: null } } }));
    let denied = false;
    await page.route("**/api/v1/agreements?*", route => {
      if (denied) return route.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } });
      const offerId = new URL(route.request().url()).searchParams.get("offerId");
      return route.fulfill({ json: { data: { offer: { offerId, companyId: ids[0], workerId: ids[0], representativeId: null, requesterId: ids[0], requesterRole: "WORKER", version: 1, termHash: "a".repeat(64), snapshot: { role: offerId === ids[0] ? "Role 1" : "Role 2", salary: 100, currency: offerId === ids[0] ? "USD" : "LKR" }, changes: [], unresolved: [] }, agreementId: ids[0], confirmation: null, answers: [], canConfirm: false } } });
    });
    await page.goto("/app/home");
    await page.getByLabel("Compare Role 1", { exact: true }).check();
    await expect(page.getByRole("button", { name: /Compare selected offers/ })).toBeDisabled();
    await page.getByLabel("Compare Role 2", { exact: true }).check();
    await page.getByRole("button", { name: /Compare selected offers/ }).click();
    const comparison = page.getByRole("region", { name: "Offer comparison", exact: true });
    await expect(comparison.getByRole("cell", { name: "USD", exact: true })).toBeVisible();
    const tableFits = await comparison.getByRole("region", { name: "Saved terms comparison table" }).evaluate(element => element.scrollWidth <= element.clientWidth);
    expect(tableFits).toBe(true);
    await page.getByLabel("Show differing terms only").check();
    await expect(comparison.getByRole("rowheader", { name: "salary", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 390 || width === 1440) await comparison.screenshot({ path: testInfo.outputPath(`comparison-${width}.png`) });
    denied = true;
    await page.getByRole("button", { name: "Reload current revisions" }).click();
    await expect(comparison.getByRole("alert")).toContainText("no longer be accessible");
    await expect(comparison.getByRole("table")).toHaveCount(0);
    denied = false;
    await page.getByRole("button", { name: "Retry comparison" }).click();
    await expect(comparison.getByRole("table")).toBeVisible();
  });
}

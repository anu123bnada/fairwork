import { expect, test } from "@playwright/test";
import { translate } from "../../src/i18n";

// Transport fixtures only: the feed contents are canned.
const id = "40000000-0000-4000-8000-000000000001";
const item = (eventKey: string, kind: string, title: string) => ({ eventKey, kind, title, href: "/app/employer", recordedAt: "2026-10-28T10:00:00Z", read: false });

test("the feed hides chosen categories on this device, says how many, and never hides case responses", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/notifications", route => route.fulfill({ json: { data: { items: [
    item("offer:1", "offer_revision", "Offer revision 1 saved"), item("case:1", "case_followup", "A response was added to your case"), item("work:1", "work_decision", "Work record verified"),
  ], nextCursor: null } } }));
  await page.goto("/app/notifications");
  await expect(page.getByText("Offer revision 1 saved")).toBeVisible();
  await page.getByText("Notification preferences (this device)").click();
  await page.getByRole("checkbox", { name: /Offer revisions/ }).uncheck();
  await expect(page.getByText("Offer revision 1 saved")).toHaveCount(0);
  await expect(page.getByText("1 item hidden by your preferences.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Case responses and appeals/ })).toBeDisabled();
  await expect(page.getByText("A response was added to your case")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Offer revision 1 saved")).toHaveCount(0);
  await expect(page.getByText("Work record verified")).toBeVisible();
  await page.getByText("Notification preferences (this device)").click();
  await page.getByRole("checkbox", { name: /Offer revisions/ }).check();
  await expect(page.getByText("Offer revision 1 saved")).toBeVisible();
});

for (const locale of ["si", "ta", "de"] as const) {
  test(`the activity feed and its preferences are translated in ${locale}`, async ({ page }) => {
    await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
    await page.route("**/api/v1/notifications", route => route.fulfill({ json: { data: { items: [item("offer:1", "offer_revision", "Offer revision 1 saved")], nextCursor: null } } }));
    await page.goto("/app/settings"); await page.getByLabel("Language").selectOption(locale);
    await page.goto("/app/notifications");
    const feed = page.getByRole("region", { name: translate(locale, "nf.aria") });
    await expect(feed).toContainText(translate(locale, "nf.intro"));
    await expect(feed).toContainText(translate(locale, "nf.unread"));
    await feed.getByText(translate(locale, "nf.prefs")).click();
    await expect(feed.getByRole("checkbox", { name: new RegExp(translate(locale, "nf.c.cases")) })).toBeDisabled();
    await feed.getByRole("checkbox", { name: new RegExp(translate(locale, "nf.c.offers")) }).uncheck();
    await expect(feed).toContainText(translate(locale, "nf.hiddenOne"));
    await expect(page.locator("body")).not.toContainText(/\b(?:nf|oc|oh|cf)\.[a-zA-Z._]+\b/);
  });
}

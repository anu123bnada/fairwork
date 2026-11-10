import { expect, test } from "@playwright/test";
import { setup, type Stored } from "./support/records-fake";

const soon = new Date(Date.now() + 86400000 * 1).toISOString().slice(0, 10);
const content = (over: Record<string, unknown>) => ({ listingId: null, organization: "", location: "", appliedOn: "", nextStepAt: "", notes: "", events: [], prep: [], ...over });

test("notifications show reminders derived from the person's own tracker records, with a link, and write nothing", async ({ page }) => {
  const writes: string[] = [];
  const store: Stored[] = [
    { id: "40000000-0000-4000-8000-0000000000a1", kind: "application", title: "Overdue step job", status: "interviewing", revision: 1, updatedAt: "2026-11-09T10:00:00Z", content: content({ nextStepAt: "2020-01-01T09:00" }) },
    { id: "40000000-0000-4000-8000-0000000000a2", kind: "application", title: "Soon job", status: "applied", revision: 1, updatedAt: "2026-11-09T10:00:00Z", content: content({ nextStepAt: `${soon}T10:00` }) },
    { id: "40000000-0000-4000-8000-0000000000a3", kind: "application", title: "Closed job", status: "rejected", revision: 1, updatedAt: "2026-11-09T10:00:00Z", content: content({ nextStepAt: `${soon}T10:00` }) },
  ];
  await setup(page, store);
  await page.route("**/api/v1/notifications", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  await page.goto("/app/notifications");
  const reminders = page.getByLabel("Reminders", { exact: true });
  await expect(reminders).toContainText("Overdue step job: the next-step date passed");
  await expect(reminders).toContainText(`Soon job: next step in 1 day(s) (${soon} 10:00).`);
  await expect(reminders).not.toContainText("Closed job");
  await expect(page.getByRole("link", { name: "Open Application tracker" })).toBeVisible();
  await expect(page.getByText("Nothing is sent and no employer is contacted.")).toBeVisible();
  expect(writes).toEqual([]);
});

test("no reminders section appears when nothing is due", async ({ page }) => {
  await setup(page, []);
  await page.route("**/api/v1/notifications", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.goto("/app/notifications");
  await expect(page.getByLabel("Reminders from your Application tracker")).toHaveCount(0);
});

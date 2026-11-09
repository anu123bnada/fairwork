import { expect, test } from "@playwright/test";
import { setup, type Stored } from "./support/records-fake";

const appId = "40000000-0000-4000-8000-0000000000b1", otherAppId = "40000000-0000-4000-8000-0000000000b2";
const future = "2099-01-15T10:00", past = "2020-01-15T10:00";
const base = (over: Record<string, unknown>) => ({ listingId: null, organization: "", location: "", appliedOn: "", nextStepAt: "", notes: "", events: [], prep: [true, true, false, false, false, false], ...over });

test("interview studio: list and by-day views, filters, add, edit stage/status/outcome/questions/feedback, save, reload, remove", async ({ page }) => {
  const saves: Record<string, unknown>[] = [];
  const store: Stored[] = [
    { id: appId, kind: "application", title: "Welder", status: "interviewing", revision: 1, updatedAt: "2026-11-09T10:00:00Z", content: base({ organization: "Demo Steel Works (DEMO)", events: [
      { id: "40000000-0000-4000-8000-0000000000c1", kind: "interview", at: future, notes: "Video call" },
      { id: "40000000-0000-4000-8000-0000000000c2", kind: "interview", at: past, notes: "Phone screen done", stage: "phone_screen", status: "completed", outcome: "passed" },
      { id: "40000000-0000-4000-8000-0000000000c3", kind: "follow_up", at: past, notes: "Sent thanks" }] }) },
    { id: otherAppId, kind: "application", title: "Cashier", status: "applied", revision: 1, updatedAt: "2026-11-09T09:00:00Z", content: base({ organization: "Demo Stores (DEMO)" }) },
  ];
  await setup(page, store, saves);
  page.on("dialog", dialog => void dialog.accept());
  await page.goto("/app/interviews");
  const list = page.getByLabel("Interviews", { exact: true });
  await expect(list.getByRole("article")).toHaveCount(2);
  await expect(list).toContainText("Preparation checklist: 2 of 6 done.");
  await expect(list).not.toContainText("Sent thanks");
  await page.getByRole("button", { name: "Upcoming" }).click();
  await expect(list.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Past" }).click();
  await expect(list).toContainText("Phone screen done");
  await page.getByRole("button", { name: "By day" }).click();
  await expect(page.getByLabel("Interviews by day").getByRole("heading", { name: "2020-01-15" })).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "List" }).click();

  const upcoming = list.getByRole("article").filter({ hasText: "2099-01-15" });
  await upcoming.getByLabel("Stage").selectOption("panel");
  await upcoming.getByLabel("Status").selectOption("completed");
  await upcoming.getByLabel("Outcome").selectOption("offer");
  await upcoming.getByLabel("Questions (to ask or expected)").fill("Ask about shift patterns.");
  await upcoming.getByLabel("Feedback and what I learned").fill("Friendly panel; asked about safety.");
  await upcoming.getByRole("button", { name: "Save interview for Welder" }).click();
  await expect(page.getByText("Interview saved.")).toBeVisible();
  const saved = saves[0] as { kind: string; expectedRevision: number; content: { events: { id: string; stage: string; status: string; outcome: string; questions: string; feedback: string }[] } };
  expect(saved).toMatchObject({ kind: "application", expectedRevision: 1 });
  expect(saved.content.events.find(item => item.id === "40000000-0000-4000-8000-0000000000c1")).toMatchObject({ stage: "panel", status: "completed", outcome: "offer", questions: "Ask about shift patterns." });
  expect(saved.content.events).toHaveLength(3);

  await page.getByLabel("Application").selectOption(otherAppId);
  await page.getByLabel("Date and time", { exact: true }).fill("2099-02-01T09:00");
  await page.getByLabel("Notes", { exact: true }).first().fill("Shop floor visit");
  await page.getByRole("button", { name: "Add interview" }).click();
  await expect(page.getByText("Interview added.")).toBeVisible();
  expect((saves[1] as { id: string }).id).toBe(otherAppId);

  await page.reload();
  await expect(page.getByLabel("Interviews", { exact: true }).getByRole("article")).toHaveCount(3);
  await expect(page.getByLabel("Interviews", { exact: true })).toContainText("Offer received");
  await page.getByRole("button", { name: "Remove interview for Cashier" }).click();
  await expect(page.getByText("Interview removed.")).toBeVisible();
  await expect(page.getByLabel("Interviews", { exact: true }).getByRole("article")).toHaveCount(2);
});

test("with no applications the studio explains what to do instead of showing an empty page", async ({ page }) => {
  await setup(page, []);
  await page.goto("/app/interviews");
  await expect(page.getByText("You have no applications yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Application tracker" })).toBeVisible();
});

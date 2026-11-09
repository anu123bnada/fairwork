import { expect, test } from "@playwright/test";
import { setup, type Stored } from "./support/records-fake";

test("career assistant: labelled DEMO, answers from the skill gap, keeps a conversation on screen only, makes no network writes", async ({ page }) => {
  const writes: string[] = [];
  await setup(page, []);
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  await page.addInitScript(() => window.localStorage.setItem("oryqen.career-skills.v1", JSON.stringify({ skills: ["MIG welding", "Safe work"], careerId: "welder" })));
  await page.goto("/app/career-assistant");
  await expect(page.getByText("It is not an AI model")).toBeVisible();
  await expect(page.getByText("Using the 2 skill(s) you chose in Career explorer on this device.")).toBeVisible();
  await page.getByRole("button", { name: "Explain my skill gap" }).click();
  const chat = page.getByLabel("Conversation");
  await expect(chat).toContainText("You cover 67% of its core skills");
  await expect(chat).toContainText("Core skills still missing: Reading drawings");
  await expect(chat).toContainText("DEMO, rule-based");
  await page.getByLabel("Your question").fill("how do I prepare for an interview");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(chat).toContainText("Ask about shifts, training and who you would report to.");
  await page.getByLabel("Your question").fill("what is the weather");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(chat).toContainText("Try one of the suggested questions.");
  await page.getByRole("button", { name: "Clear the conversation" }).click();
  await expect(page.getByText("Choose a suggested question or type your own.")).toBeVisible();
  expect(writes).toEqual([]);
});

test("sample employers keep sample information, user-submitted information and verified facts apart and never show verification", async ({ page }) => {
  await setup(page, []);
  await page.goto("/app/employers-demo");
  await expect(page.getByText("SAMPLE DATA.")).toBeVisible();
  const profile = page.getByLabel("Profile of Demo Steel Works (SAMPLE)");
  await expect(profile.getByLabel("Sample information (invented for the demo)")).toContainText("Welder");
  await expect(profile.getByLabel("Information submitted by users")).toContainText("None in this demonstration");
  await expect(profile.getByLabel("Verified facts")).toContainText("None.");
  await expect(profile.getByLabel("Verified facts")).toContainText("A sample company cannot be verified");
  await page.getByLabel("Search sample employers").fill("accounting");
  await expect(page.locator(`ul[aria-label="Sample employers"] > li`)).toHaveCount(1);
  await page.getByRole("button", { name: "View Demo Accounting Partners (SAMPLE)" }).click();
  await expect(page.getByLabel("Profile of Demo Accounting Partners (SAMPLE)")).toContainText("Accounts clerk");
  await page.getByLabel("Search sample employers").fill("zzz");
  await expect(page.getByText("No sample employer matches your search.")).toBeVisible();
});

test("demo center: loads sample records into the person's own account once, shows them in the screens, removes only the marked ones", async ({ page }) => {
  const store: Stored[] = [{ id: "40000000-0000-4000-8000-0000000000d1", kind: "application", title: "My real application", status: "applied", revision: 1, updatedAt: "2026-11-09T10:00:00Z", content: { listingId: null, organization: "Mine", location: "", appliedOn: "", nextStepAt: "", notes: "", events: [], prep: [] } }];
  const saves: Record<string, unknown>[] = [];
  await setup(page, store, saves);
  page.on("dialog", dialog => void dialog.accept());
  await page.goto("/app/demo");
  await expect(page.getByText("DEMO MODE.")).toBeVisible();
  await expect(page.getByRole("table", { name: "What is real and what is sample" })).toContainText("DEMO: fixed rules, no AI model.");
  await page.getByRole("button", { name: "Load sample records" }).click();
  await expect(page.getByText("Sample records loaded: 7 added, 0 already there.")).toBeVisible();
  expect(saves).toHaveLength(7);
  expect(saves.every(save => String(save.title).endsWith(" (DEMO)"))).toBe(true);
  expect(saves.map(save => save.kind).sort()).toEqual(["application", "application", "application", "cover_letter", "portfolio", "project", "roadmap"]);
  await page.getByRole("button", { name: "Load sample records" }).click();
  await expect(page.getByText("Sample records loaded: 0 added, 7 already there.")).toBeVisible();
  expect(saves).toHaveLength(7);
  await page.goto("/app/interviews");
  await expect(page.getByLabel("Interviews", { exact: true }).getByRole("article")).toHaveCount(2);
  await expect(page.getByLabel("Interviews", { exact: true })).toContainText("Phone screen · Completed · Passed");
  await page.goto("/app/workroom");
  await expect(page.locator(".oq-rec-list")).toContainText("Workshop tidy-up (DEMO) · Active · 2 of 4 tasks done (50%)");
  await page.goto("/app/demo");
  await page.getByRole("button", { name: "Remove sample records" }).click();
  await expect(page.getByText("Removed 7 sample record(s).")).toBeVisible();
  expect(store.map(item => item.title)).toEqual(["My real application"]);
});

test("add a job offer: the sample offer button fills in a clearly labelled synthetic offer", async ({ page }) => {
  await setup(page, []);
  await page.goto("/app/add-offer");
  await page.getByRole("button", { name: "Fill in a sample offer (DEMO)" }).click();
  await expect(page.getByLabel("Paste offer text")).toHaveValue(/DEMO SAMPLE OFFER \(synthetic, not a real employer\)/);
  await expect(page.getByLabel("Paste offer text")).toHaveValue(/uniform deposit/);
  await expect(page.getByText("The sample is synthetic text written for this demonstration.")).toBeVisible();
});

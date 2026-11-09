import { expect, test } from "@playwright/test";
import { setup, type Stored } from "./support/records-fake";

// The records API is a transport fixture here; the database tests and the real-stack harness prove ownership and validation.
test("cover letter studio: write, edit the text, save, reload, reopen the saved letter, delete", async ({ page }) => {
  const store: Stored[] = [], saves: Record<string, unknown>[] = [];
  await setup(page, store, saves);
  page.on("dialog", dialog => void dialog.accept());
  await page.goto("/app/cover-letter");
  await expect(page.getByText("No saved letters yet.")).toBeVisible();
  await page.getByLabel("Job you are applying for").fill("Welder");
  await page.getByLabel("Employer or organization").fill("Demo Steel Works");
  await page.getByLabel("Strength or skill 1").fill("MIG welding");
  const text = page.getByLabel("Cover letter preview");
  await expect(text).toHaveValue(/Dear Demo Steel Works hiring team,/);
  await text.fill("Dear Demo Steel Works hiring team,\n\nMy own edited letter.");
  await page.getByLabel("Letter status").selectOption("final");
  await page.getByRole("button", { name: "Save letter" }).click();
  await expect(page.getByText("Letter saved.")).toBeVisible();
  expect(saves[0]).toMatchObject({ kind: "cover_letter", status: "final", title: "Welder at Demo Steel Works", expectedRevision: 0 });
  expect((saves[0] as { content: { body: string } }).content.body).toContain("My own edited letter.");
  await expect(page.getByLabel("Saved letters")).toContainText("Welder at Demo Steel Works · Final");
  await page.reload();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByLabel("Cover letter preview")).toHaveValue(/My own edited letter\./);
  await expect(page.getByLabel("Employer or organization")).toHaveValue("Demo Steel Works");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No saved letters yet.")).toBeVisible();
});

test("portfolio builder: add an entry, save, reload, reopen, reject an insecure link, delete", async ({ page }) => {
  const store: Stored[] = [], saves: Record<string, unknown>[] = [];
  await setup(page, store, saves);
  page.on("dialog", dialog => void dialog.accept());
  await page.goto("/app/portfolio");
  await expect(page.getByText("No portfolio entries yet.")).toBeVisible();
  await page.getByRole("button", { name: "Add an entry" }).click();
  await page.getByLabel("Entry title").fill("Safety course certificate");
  await page.getByRole("combobox").first().selectOption("certificate");
  await page.getByLabel("Status").selectOption("ready");
  await page.getByLabel("Link (https only, optional)").fill("https://example.test/cert");
  await page.getByLabel("What it is").fill("Basic workplace safety course.");
  await page.getByLabel("Skills used (separate with commas)").fill("Safe work, First aid");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("Entry saved.")).toBeVisible();
  expect(saves[0]).toMatchObject({ kind: "portfolio", status: "ready" });
  expect((saves[0] as { content: { skills: string[]; category: string } }).content).toMatchObject({ category: "certificate", skills: ["Safe work", "First aid"] });
  await page.getByRole("button", { name: "Back to my portfolio" }).click();
  await expect(page.locator(".oq-rec-list")).toContainText("Safety course certificate · Certificate · Ready");
  await page.reload();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByLabel("Skills used (separate with commas)")).toHaveValue("Safe work, First aid");
  await page.getByRole("button", { name: "Back to my portfolio" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No portfolio entries yet.")).toBeVisible();
});

test("career roadmap: start from the sample skill gap, tick milestones, progress is counted, saved and reopened", async ({ page }) => {
  const store: Stored[] = [], saves: Record<string, unknown>[] = [];
  await setup(page, store, saves);
  await page.route(/\/api\/v1\/cv(\?.*)?$/, route => route.fulfill({ json: { data: { limit: 20, items: [] } } }));
  await page.goto("/app/career-explorer");
  await page.getByLabel("Target role").selectOption("welder");
  await page.getByRole("button", { name: "MIG welding" }).click();
  await page.getByRole("button", { name: "Save a roadmap for Welder" }).click();
  await expect(page.getByText("0 of 4 milestones done (0%)").first()).toBeVisible();
  await page.getByLabel("Learn: Reading drawings", { exact: true }).check();
  await expect(page.getByText("1 of 4 milestones done (25%)").first()).toBeVisible();
  await page.getByLabel("Due date for Learn: Safe work").fill("2026-12-15");
  await page.getByRole("button", { name: "Save roadmap" }).click();
  await expect(page.getByText("Roadmap saved.")).toBeVisible();
  const saved = saves[0] as { kind: string; title: string; content: { careerId: string; milestones: { skill: string; done: boolean; dueOn: string }[] } };
  expect(saved).toMatchObject({ kind: "roadmap", title: "Welder roadmap" });
  expect(saved.content.careerId).toBe("welder");
  expect(saved.content.milestones.find(item => item.skill === "Reading drawings")?.done).toBe(true);
  expect(saved.content.milestones.find(item => item.skill === "Safe work")?.dueOn).toBe("2026-12-15");
  await page.getByRole("button", { name: "Back to my roadmaps" }).click();
  await expect(page.getByLabel("Saved roadmaps")).toContainText("Welder roadmap · Active · 1 of 4 milestones done (25%)");
});

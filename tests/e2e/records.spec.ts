import { expect, test, type Page } from "@playwright/test";

const me = "40000000-0000-4000-8000-000000000001", listingId = "40000000-0000-4000-8000-000000000041";
type Stored = { id: string; kind: "application" | "project"; title: string; status: string; content: Record<string, unknown>; revision: number; updatedAt: string };
const time = "2026-11-09T10:00:00Z";

// Transport fixture only (a small stateful fake of the records API): the database tests and the real-stack harness prove ownership, validation and revisions.
async function setup(page: Page, store: Stored[], saves: Record<string, unknown>[] = [], saveStatus = 200) {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: me, displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/opportunities**", route => route.fulfill({ json: { data: { preferences: null, preferenceVersion: 0, nextCursor: null, items: [{ id: listingId, companyId: me, companyName: "Demo Steel Works (DEMO)", version: 1,
    fields: { title: "Welder", description: "MIG welding of steel frames.", location: "Kandy", workMode: "onsite", salary: null, currency: "LKR", payPeriod: "month" }, status: "published", expiresAt: "2027-01-01T00:00:00Z", updatedAt: time, choice: "none", canEdit: false, source: "representative_submission", assurance: "demo_provisioned" }] } } }));
  await page.route(/\/api\/v1\/records(\?.*)?$/, route => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Stored & { expectedRevision: number }; saves.push(body);
      if (saveStatus !== 200) return route.fulfill({ status: saveStatus, json: { error: { code: saveStatus === 409 ? "VERSION_CONFLICT" : "VALIDATION_FAILED" } } });
      const existing = store.find(item => item.id === body.id);
      if (existing) { Object.assign(existing, { title: body.title, status: body.status, content: body.content, revision: existing.revision + 1 }); }
      else store.push({ id: body.id, kind: body.kind, title: body.title, status: body.status, content: body.content, revision: 1, updatedAt: time });
      return route.fulfill({ json: { data: { id: body.id, revision: store.find(item => item.id === body.id)!.revision } } });
    }
    const id = url.searchParams.get("id");
    if (id) return route.fulfill({ json: { data: store.find(item => item.id === id) } });
    const kind = url.searchParams.get("kind");
    const summary = (item: Stored) => { const c = item.content as { organization?: string; nextStepAt?: string; appliedOn?: string; dueOn?: string; tasks?: { done: boolean }[]; events?: unknown[] };
      return { id: item.id, kind: item.kind, title: item.title, status: item.status, revision: item.revision, updatedAt: item.updatedAt, summary: { organization: c.organization ?? null, nextStepAt: c.nextStepAt || null, appliedOn: c.appliedOn || null, dueOn: c.dueOn || null, taskCount: c.tasks?.length ?? 0, tasksDone: c.tasks?.filter(task => task.done).length ?? 0, eventCount: c.events?.length ?? 0 } }; };
    return route.fulfill({ json: { data: { limit: 100, items: store.filter(item => item.kind === kind).map(summary) } } });
  });
  await page.route("**/api/v1/records/remove", route => { const { id } = route.request().postDataJSON() as { id: string }; store.splice(0, store.length, ...store.filter(item => item.id !== id)); return route.fulfill({ json: { data: { id } } }); });
}

test("application tracker: add an application from a published listing, schedule an interview, tick preparation, save, filter by stage, reopen and delete", async ({ page }) => {
  const store: Stored[] = [], saves: Record<string, unknown>[] = [];
  await setup(page, store, saves);
  page.on("dialog", dialog => void dialog.accept());
  await page.goto("/app/applications");
  await expect(page.getByText("No applications yet. Add one to start tracking.")).toBeVisible();
  await page.getByRole("button", { name: "Add an application" }).click();
  await page.getByRole("button", { name: "Choose from published listings" }).click();
  await page.getByRole("combobox", { name: "Published listing" }).selectOption(listingId);
  await expect(page.getByLabel("Job title")).toHaveValue("Welder");
  await expect(page.getByLabel("Employer or organization")).toHaveValue("Demo Steel Works (DEMO)");
  await page.getByLabel("Stage").selectOption("interviewing");
  await page.getByLabel("Date applied").fill("2026-11-01");
  await page.getByLabel("Next step (date and time)").fill("2026-11-12T09:30");
  await page.getByLabel("I researched the employer").check();
  await page.getByLabel("I prepared three examples of my work").check();
  await page.getByRole("group", { name: "Interviews and follow-ups" }).getByRole("combobox").selectOption("interview");
  await page.getByLabel("Date and time", { exact: true }).fill("2026-11-12T09:30");
  await page.getByLabel("Details").fill("Phone interview");
  await page.getByRole("button", { name: "Add to the list" }).click();
  await expect(page.getByText("Interview · 2026-11-12 09:30 · Phone interview")).toBeVisible();
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page.getByText("Application saved.")).toBeVisible();

  const saved = saves[0] as { kind: string; status: string; expectedRevision: number; content: { listingId: string; prep: boolean[]; events: { kind: string; notes: string }[]; organization: string } };
  expect(saved).toMatchObject({ kind: "application", status: "interviewing", expectedRevision: 0 });
  expect(saved.content.listingId).toBe(listingId);
  expect(saved.content.prep).toEqual([true, false, true, false, false, false]);
  expect(saved.content.events).toMatchObject([{ kind: "interview", notes: "Phone interview" }]);

  await page.getByRole("button", { name: "Back to my applications" }).click();
  const list = page.locator(".oq-rec-list");
  await expect(list).toContainText("Welder");
  await expect(list).toContainText("Interviewing");
  await expect(page.getByLabel("Upcoming next steps")).toContainText("2026-11-12 09:30 · Welder");
  await expect(page.getByRole("button", { name: "Interviewing (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Applied (0)" }).click();
  await expect(list.getByText("Welder")).toHaveCount(0);
  await page.getByRole("button", { name: /^All \(1\)/ }).click();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByLabel("Stage")).toHaveValue("interviewing");
  await expect(page.getByLabel("I researched the employer")).toBeChecked();
  await page.getByRole("button", { name: "Back to my applications" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No applications yet. Add one to start tracking.")).toBeVisible();
});

test("workroom: plan a project with milestones and tasks, progress is counted from ticked tasks, and it persists", async ({ page }) => {
  const store: Stored[] = [], saves: Record<string, unknown>[] = [];
  await setup(page, store, saves);
  await page.goto("/app/workroom");
  await page.getByRole("button", { name: "Add a project" }).click();
  await page.getByLabel("Project name").fill("Workshop tidy-up");
  await page.getByLabel("Status").selectOption("active");
  await page.getByLabel("New task").fill("Label shelves");
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByLabel("New task").fill("Clean bench");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("0 of 2 tasks done (0%)").first()).toBeVisible();
  await page.getByLabel("Label shelves").check();
  await expect(page.getByText("1 of 2 tasks done (50%)").first()).toBeVisible();
  await page.getByLabel("New milestone").fill("Sort tools");
  await page.getByLabel("Milestone due date").fill("2026-12-01");
  await page.getByRole("button", { name: "Add milestone" }).click();
  await expect(page.getByText("Sort tools · due 2026-12-01")).toBeVisible();
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Project saved.")).toBeVisible();
  const saved = saves[0] as { kind: string; content: { tasks: { title: string; done: boolean }[]; milestones: { title: string; dueOn: string }[] } };
  expect(saved.kind).toBe("project");
  expect(saved.content.tasks).toMatchObject([{ title: "Label shelves", done: true }, { title: "Clean bench", done: false }]);
  expect(saved.content.milestones).toMatchObject([{ title: "Sort tools", dueOn: "2026-12-01" }]);
  await page.getByRole("button", { name: "Back to my projects" }).click();
  await expect(page.locator(".oq-rec-list")).toContainText("Workshop tidy-up · Active · 1 of 2 tasks done (50%)");
});

test("a conflicting or rejected save is reported plainly and keeps the person's edits", async ({ page }) => {
  await setup(page, [], [], 409);
  await page.goto("/app/applications");
  await page.getByRole("button", { name: "Add an application" }).click();
  await page.getByLabel("Job title").fill("Picker");
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page.getByText("This application was changed somewhere else.")).toBeVisible();
  await expect(page.getByLabel("Job title")).toHaveValue("Picker");
  await page.unroute(/\/api\/v1\/records(\?.*)?$/);
  await page.route(/\/api\/v1\/records(\?.*)?$/, route => route.request().method() === "POST" ? route.fulfill({ status: 422, json: { error: { code: "VALIDATION_FAILED" } } }) : route.fulfill({ json: { data: { limit: 100, items: [] } } }));
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page.getByText("Some details are not allowed")).toBeVisible();
});

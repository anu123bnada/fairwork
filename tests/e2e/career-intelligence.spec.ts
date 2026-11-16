import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Career Gap Analyzer and Opportunity Intelligence with a small in-memory stand-in for the records and listings API (shaped like the real replies; the app's strict schemas parse them).
// This proves the screens, the rules and the recalculation. It is NOT evidence that the hosted service stores the records: that needs the new database migration applied.
const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Stored = { id: string; kind: string; title: string; status: string; content: Record<string, unknown>; revision: number; updatedAt: string };

async function api(page: Page, listings: unknown[]) {
  const db = new Map<string, Stored>();
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/opportunities?*", route => route.fulfill({ json: { data: { items: listings, nextCursor: null, preferences: null, preferenceVersion: 0 } } }));
  await page.route("**/api/v1/records**", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "POST") {
      const body = request.postDataJSON() as Stored & { expectedRevision: number };
      const current = db.get(body.id);
      if ((current?.revision ?? 0) !== body.expectedRevision) return route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT" } } });
      const revision = (current?.revision ?? 0) + 1;
      db.set(body.id, { id: body.id, kind: body.kind, title: body.title, status: body.status, content: body.content, revision, updatedAt: "2026-11-16T09:00:00Z" });
      return route.fulfill({ json: { data: { id: body.id, revision } } });
    }
    const wanted = url.searchParams.get("id");
    if (wanted) { const row = db.get(wanted); return row ? route.fulfill({ json: { data: row } }) : route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } }); }
    const kind = url.searchParams.get("kind");
    const empty = { organization: null, nextStepAt: null, appliedOn: null, dueOn: null, taskCount: 0, tasksDone: 0, eventCount: 0, milestoneCount: 0, milestonesDone: 0, category: null, careerId: null, role: null };
    return route.fulfill({ json: { data: { items: [...db.values()].filter(row => row.kind === kind).map(row => ({ id: row.id, kind: row.kind, title: row.title, status: row.status, revision: row.revision, updatedAt: row.updatedAt, summary: empty })), limit: 100 } } });
  });
  // Registered last so it wins over the broader records route above (the most recent route takes precedence).
  await page.route("**/api/v1/records/remove", route => { const body = route.request().postDataJSON() as { id: string }; db.delete(body.id); return route.fulfill({ json: { data: { id: body.id } } }); });
  return db;
}
const listing = (n: number, title: string, description: string, over: Record<string, unknown> = {}) => ({
  id: id(n), companyId: id(90), companyName: "DEMO Studio", version: 1, status: "published", choice: "none", canEdit: false, updatedAt: "2026-11-15T08:00:00Z", expiresAt: "2026-12-20T00:00:00Z",
  fields: { title, description, location: "Colombo", workMode: "hybrid", salary: null, currency: "LKR", payPeriod: "month", ...over }, source: "representative_submission", assurance: "demo_provisioned",
});

test("career gap analyzer: goal, evidence levels, free courses, progress recalculates the gaps, save and delete", async ({ page }) => {
  test.setTimeout(120_000);
  const db = await api(page, []);
  await page.goto("/app/career-intelligence");
  await expect(page.getByRole("heading", { name: "Choose your career goal" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Primary career goal").selectOption("junior-web-developer");
  await expect(page.getByText("0 / 4", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Rules-based explanation. No AI model was used", { exact: false })).toBeVisible();
  // A self-reported skill is a covered skill but is never shown as verified.
  await page.getByLabel("Add a skill").fill("HTML");
  await page.getByRole("button", { name: "Add skill" }).click();
  await expect(page.locator(".oq-ci-pill-ok", { hasText: "Self-reported, no proof" })).toHaveCount(1);
  await expect(page.getByText("1 / 4", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/verified/i).filter({ hasText: /^verified$/i })).toHaveCount(0);
  // Courses: verified title, provider, direct link, certificate wording.
  const css = page.getByLabel("Learn CSS");
  await expect(css).toBeVisible();
  await expect(css.getByText("web.dev (Google)")).toBeVisible();
  await expect(css.getByRole("link", { name: "Open course (new tab)" })).toHaveAttribute("href", "https://web.dev/learn/css");
  await expect(css.getByText("Certificate: none offered", { exact: false })).toBeVisible();
  await expect(page.getByText("No verified free course for this skill is in ORYQEN's catalog yet", { exact: false })).toBeVisible();
  // Progress: marking a course complete saves and recalculates the remaining gaps.
  await css.getByRole("button", { name: "Mark as completed" }).click();
  await expect(page.getByText("Marked complete. Your gaps were recalculated.")).toBeVisible();
  await expect(page.getByText("Course finished, not yet shown in practice")).toBeVisible();
  await expect(page.getByText("2 / 4", { exact: false }).first()).toBeVisible();
  expect([...db.values()].filter(row => row.kind === "career_profile")).toHaveLength(1);
  await expect(page.getByText("Finishing a course does not by itself qualify anyone", { exact: false })).toBeVisible();
  // The profile survives a reload from the stored record.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your goal: Junior web developer" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("2 / 4", { exact: false }).first()).toBeVisible();
  page.once("dialog", dialog => void dialog.accept());
  await page.getByRole("button", { name: "Delete my profile" }).click();
  await expect(page.getByText("Your career profile was deleted.")).toBeVisible();
  expect([...db.values()]).toHaveLength(0);
});

test("career gap analyzer on a server without the new record kind: still usable, says nothing can be stored", async ({ page }) => {
  await api(page, []);
  await page.route("**/api/v1/records**", route => route.fulfill({ status: 422, json: { error: { code: "VALIDATION_FAILED" } } }));
  await page.goto("/app/career-intelligence");
  await expect(page.getByText("changes may not be stored", { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Primary career goal").selectOption("junior-web-developer");
  await expect(page.getByText("0 / 4", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("may not yet support saving this profile", { exact: false })).toBeVisible();
});

test("regulated profession: a course never satisfies a licence and no trade course is invented", async ({ page }) => {
  await api(page, []);
  await page.goto("/app/career-intelligence");
  await page.getByLabel("Primary career goal").selectOption("electrician");
  await expect(page.getByText("Electrical trade licence or registration")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("A course alone does not give this licence", { exact: false })).toBeVisible();
  await expect(page.getByText("No verified free course for this skill is in ORYQEN's catalog yet", { exact: false }).first()).toBeVisible();
});

test("opportunity intelligence: honest connections, explained matching, feedback that persists and resets", async ({ page }) => {
  test.setTimeout(120_000);
  const db = await api(page, [
    listing(1, "Junior web developer", "You will build pages with HTML, CSS and JavaScript. A degree is helpful."),
    listing(2, "Cashier", "Serve customers and handle the till at a busy shop."),
  ]);
  await page.goto("/app/opportunity-intelligence");
  await expect(page.getByRole("heading", { name: "Opportunities matched to you" })).toBeVisible({ timeout: 30_000 });
  for (const name of ["LinkedIn", "Facebook", "Instagram", "Fiverr"]) await expect(page.getByRole("heading", { name: "Connection center" }).locator("xpath=..").getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText("Not connected").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect (not available)" }).first()).toBeDisabled();
  await expect(page.getByText("Connected (built in)")).toBeVisible();
  await expect(page.getByText("Refresh: manual only", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Junior web developer" })).toBeVisible();
  await expect(page.getByText("demonstration-provisioned", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Missing requirements:", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("not a prediction", { exact: false }).first()).toBeVisible();
  // Feedback: dislike hides the listing, the record is stored, reset deletes it.
  await page.getByRole("group", { name: "Feedback on Cashier" }).getByRole("button", { name: "Dislike" }).click();
  await expect(page.getByText("Saved. Future ordering will use this.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cashier" })).toHaveCount(0);
  await expect(page.getByText("1 hidden by your feedback")).toBeVisible();
  expect([...db.values()].filter(row => row.kind === "opportunity_feedback")).toHaveLength(1);
  page.once("dialog", dialog => void dialog.accept());
  await page.getByRole("button", { name: "Reset my feedback" }).click();
  await expect(page.getByText("Your recommendation preferences were reset", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cashier" })).toBeVisible();
  expect([...db.values()]).toHaveLength(0);
});

test("opportunity intelligence says so when there are no listings and invents none", async ({ page }) => {
  await api(page, []);
  await page.goto("/app/opportunity-intelligence");
  await expect(page.getByText("No published listings match right now", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Nothing is invented to fill this list.")).toBeVisible();
});

for (const [label, width, height] of [["1440", 1440, 900], ["390", 390, 844], ["360", 360, 780]] as const) {
  for (const [name, path, anchor] of [["career-intelligence", "/app/career-intelligence", "Choose your career goal"], ["opportunity-intelligence", "/app/opportunity-intelligence", "Opportunities matched to you"]] as const) {
    test(`${name} at ${label}px: no overflow, no script errors, captured`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on("console", message => { if (message.type() === "error" && !/Failed to load resource|503|net::ERR/.test(message.text())) errors.push(message.text()); });
      page.on("pageerror", error => errors.push(error.message));
      await api(page, [listing(1, "Junior web developer", "You will build pages with HTML, CSS and JavaScript."), listing(2, "Cashier", "Serve customers and handle the till at a busy shop.")]);
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await expect(page.getByText(anchor, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
      if (name === "career-intelligence") {
        await page.getByLabel("Primary career goal").selectOption("junior-web-developer");
        await page.getByLabel("Add a skill").fill("HTML");
        await page.getByRole("button", { name: "Add skill" }).click();
        await expect(page.getByText("Your free learning path")).toBeVisible();
      }
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${label}: horizontal overflow`).toBe(true);
      await page.addStyleTag({ content: ".fw-fixed-action, .fw-nav-fab, .fw-bottom-nav { position: static !important; } .fw-product-body { padding-bottom: 24px !important; }" });
      mkdirSync("test-results/career-qa", { recursive: true });
      await page.screenshot({ path: `test-results/career-qa/${name}-${label}.png`, fullPage: true, animations: "disabled" });
      expect(errors, `${name} ${label}: script errors`).toEqual([]);
    });
  }
}

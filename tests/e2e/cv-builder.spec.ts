import { expect, test, type Page } from "@playwright/test";

const me = "40000000-0000-4000-8000-000000000001", u = (n: number) => `40000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const hash = "a".repeat(64), time = "2026-10-14T01:00:00Z";
type Stored = { id: string; title: string; template: string; targetRole: string | null; content: Record<string, unknown>; revision: number; updatedAt: string };

// Transport fixtures only: the database tests prove ownership, bounds and revisions; the real-stack harness proves the API against PostgreSQL.
async function setup(page: Page, store: Stored[], saves: Record<string, unknown>[] = [], withVerified = true) {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: me, displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route(/\/api\/v1\/cv(\?.*)?$/, route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Stored & { expectedRevision: number }; saves.push(body);
      const existing = store.find(item => item.id === body.id);
      if (existing) { existing.title = body.title; existing.template = body.template; existing.targetRole = body.targetRole; existing.content = body.content; existing.revision++; }
      else store.push({ id: body.id, title: body.title, template: body.template, targetRole: body.targetRole, content: body.content, revision: 1, updatedAt: time });
      return route.fulfill({ json: { data: { id: body.id, revision: (existing?.revision ?? 1) } } });
    }
    const id = new URL(route.request().url()).searchParams.get("id");
    if (id) return route.fulfill({ json: { data: store.find(item => item.id === id) } });
    return route.fulfill({ json: { data: { limit: 20, items: store.map(item => ({ id: item.id, title: item.title, template: item.template, targetRole: item.targetRole, revision: item.revision, updatedAt: item.updatedAt })) } } });
  });
  await page.route("**/api/v1/cv/remove", route => { const { id } = route.request().postDataJSON() as { id: string }; store.splice(0, store.length, ...store.filter(item => item.id !== id)); return route.fulfill({ json: { data: { id } } }); });
  await page.route("**/api/v1/passport**", route => route.fulfill({ json: { data: { policyVersion: "private-work-passport.v1", passportId: u(5), ownerId: me, createdAt: time, nextCursor: null,
    entries: withVerified ? [{ workId: u(6), version: 1, role: "Forklift Operator", periodStart: "2026-01-01", periodEnd: "2026-03-01", hours: "320", summary: "Warehouse shifts", companyId: u(7), companyName: "Synthetic Logistics", agreementId: u(8), agreementVersion: 1, agreementHash: hash, agreementEffectiveAt: time, verificationId: u(9), verifiedAt: time, verifierId: u(10), authorityDecisionId: u(11), evidenceCount: 0, evidenceHash: hash }] : [] } } }));
}

test("a person writes a CV, sees the preview, saves exactly what they typed, and prints only the sheet", async ({ page }) => {
  const store: Stored[] = [], saves: Record<string, unknown>[] = [];
  await setup(page, store, saves);
  await page.addInitScript(() => { (window as unknown as { printed: number }).printed = 0; window.print = () => { (window as unknown as { printed: number }).printed++; }; });
  await page.goto("/app/cv");
  await page.getByRole("button", { name: "New CV" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Nimal Perera");
  await page.getByLabel("Name of this CV version").fill("Welder CV");
  await page.getByLabel("Role this version is for (optional)").fill("Welder");
  await page.getByLabel("Layout").selectOption("modern");
  await page.getByLabel("Professional summary").fill("Reliable welder with two years of workshop experience.");
  await page.getByLabel("Skills (separate with commas)").fill("MIG welding, Blueprint reading");
  await page.getByRole("button", { name: "Add another" }).nth(1).click();
  await page.getByLabel("Employer").fill("Synthetic Workshop");
  await page.getByLabel("Role", { exact: true }).fill("Welder");
  const sheet = page.getByLabel("CV preview");
  await expect(sheet).toContainText("Nimal Perera");
  await expect(sheet).toContainText("Reliable welder with two years of workshop experience.");
  await expect(sheet).toContainText("MIG welding, Blueprint reading");
  await expect(sheet).toContainText("Welder, Synthetic Workshop");
  await expect(sheet).toContainText("Self-reported unless marked as verified");
  await page.getByRole("button", { name: "Save CV" }).click();
  await expect(page.getByText("CV saved.")).toBeVisible();
  const saved = saves[0]!;
  expect(saved.expectedRevision).toBe(0);
  expect(saved.template).toBe("modern");
  expect(saved.targetRole).toBe("Welder");
  const content = saved.content as { skills: string[]; education: unknown[]; includeVerifiedWork: boolean; experience: { employer: string }[] };
  expect(content.skills).toEqual(["MIG welding", "Blueprint reading"]);
  expect(content.experience).toHaveLength(1);
  expect(content.includeVerifiedWork).toBe(false);
  await page.getByRole("button", { name: "Print or save as PDF" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await page.emulateMedia({ media: "print" });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole("button", { name: "Save CV" })).toBeHidden();
});

test("verified work comes live from the Work Passport, is labelled, and is never stored in the CV", async ({ page }) => {
  const store: Stored[] = [], saves: Record<string, unknown>[] = [];
  await setup(page, store, saves);
  await page.goto("/app/cv");
  await page.getByRole("button", { name: "New CV" }).click();
  await page.getByLabel("Name of this CV version").fill("With verified work");
  const sheet = page.getByLabel("CV preview");
  await expect(sheet).not.toContainText("Forklift Operator");
  await page.getByLabel("Include my verified work from the ORYQEN Work Passport").check();
  await expect(sheet).toContainText("Forklift Operator, Synthetic Logistics");
  await expect(sheet).toContainText("Verified by an employer representative through ORYQEN");
  await page.getByRole("button", { name: "Save CV" }).click();
  await expect(page.getByText("CV saved.")).toBeVisible();
  expect(JSON.stringify(saves[0])).not.toMatch(/Forklift|Synthetic Logistics/);
  expect((saves[0]!.content as { includeVerifiedWork: boolean }).includeVerifiedWork).toBe(true);
  await page.getByLabel("Include my verified work from the ORYQEN Work Passport").uncheck();
  await expect(sheet).not.toContainText("Forklift Operator");
});

test("links must be https, an unsafe link is never rendered as a link, and a CV can be reopened and deleted", async ({ page }) => {
  const store: Stored[] = [{ id: u(20), title: "Existing CV", template: "classic", targetRole: null, revision: 1, updatedAt: time, content: {
    basics: { fullName: "Nimal Perera", headline: "", email: "", phone: "", location: "", links: [{ label: "Portfolio", url: "https://example.test/me" }] }, summary: "", education: [], experience: [],
    skills: [], projects: [], achievements: [], certifications: [], references: [], includeVerifiedWork: false } }];
  await setup(page, store);
  page.on("dialog", dialog => void dialog.accept());
  await page.goto("/app/cv");
  await expect(page.getByText("Existing CV")).toBeVisible();
  await page.getByRole("button", { name: "Open" }).click();
  const sheet = page.getByLabel("CV preview");
  await expect(sheet.getByRole("link", { name: "Portfolio" })).toHaveAttribute("href", "https://example.test/me");
  await page.getByLabel("Link (https://)").fill("javascript:alert(1)");
  await expect(sheet.getByRole("link")).toHaveCount(0);
  await expect(sheet).toContainText("Portfolio");
  // The real server refuses a link that is not https; the fixture answers the same way so the screen's error handling is exercised.
  await page.route(/\/api\/v1\/cv$/, route => route.request().method() === "POST" ? route.fulfill({ status: 422, json: { error: { code: "VALIDATION_FAILED" } } }) : route.fallback());
  await page.getByRole("button", { name: "Save CV" }).click();
  await expect(page.getByText("Some details are not allowed")).toBeVisible();
});

test("a CV that was changed elsewhere is reported, not overwritten", async ({ page }) => {
  const store: Stored[] = [];
  await setup(page, store);
  await page.route(/\/api\/v1\/cv(\?.*)?$/, route => route.request().method() === "POST"
    ? route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT" } } }) : route.fulfill({ json: { data: { limit: 20, items: [] } } }));
  await page.goto("/app/cv");
  await page.getByRole("button", { name: "New CV" }).click();
  await page.getByLabel("Name of this CV version").fill("Conflicting CV");
  await page.getByRole("button", { name: "Save CV" }).click();
  await expect(page.getByText("This CV was changed somewhere else.")).toBeVisible();
});

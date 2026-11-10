import { expect, test } from "@playwright/test";
import { listingId, setup } from "./support/records-fake";

// Transport fixture for the applications API. The cross-company isolation, minimal sharing and review rules are proven by the database tests, not here.
const appId = "40000000-0000-4000-8000-0000000000a1";
type Row = { id: string; applicantName: string; message: string; status: string; revision: number; createdAt: string };

test("a person applies from a listing, sees it in the tracker with its status, and can withdraw it", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  const mine: { id: string; listingId: string; listingTitle: string; message: string; status: string; revision: number; createdAt: string; updatedAt: string }[] = [];
  await setup(page, []);
  await page.route(/\/api\/v1\/applications(\?.*)?$/, route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>; sent.push(body);
      if (body.action === "submit") { mine.push({ id: String(body.id), listingId: String(body.listingId), listingTitle: "Welder", message: String(body.message), status: "submitted", revision: 1, createdAt: "2026-11-10T09:00:00Z", updatedAt: "2026-11-10T09:00:00Z" }); return route.fulfill({ json: { data: { id: body.id, revision: 1 } } }); }
      mine[0]!.status = "withdrawn"; mine[0]!.revision = 2; return route.fulfill({ json: { data: { id: body.id, revision: 2 } } });
    }
    return route.fulfill({ json: { data: { items: mine, limit: 100 } } });
  });
  page.on("dialog", dialog => void dialog.accept());
  await page.goto("/app/opportunities");
  await page.getByRole("button", { name: "Apply to Welder" }).click();
  await expect(page.getByText("the organization sees only your display name and the message below")).toBeVisible();
  await page.getByLabel("Your message to the organization (optional)").fill("I have two years of welding experience.");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText("Application sent for Welder.")).toBeVisible();
  expect(sent[0]).toMatchObject({ action: "submit", listingId, message: "I have two years of welding experience." });
  expect(Object.keys(sent[0]!).sort()).toEqual(["action", "id", "listingId", "message"]);
  await page.goto("/app/applications");
  const section = page.getByLabel("Applications sent through ORYQEN");
  await expect(section).toContainText("Welder · Submitted");
  await section.getByRole("button", { name: "Withdraw" }).click();
  await expect(section).toContainText("Welder · Withdrawn");
  await expect(section.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
  expect(sent[1]).toMatchObject({ action: "withdraw", id: sent[0]!.id, expectedRevision: 1 });
});

test("a refused application is explained plainly", async ({ page }) => {
  await setup(page, []);
  await page.route(/\/api\/v1\/applications(\?.*)?$/, route => route.request().method() === "POST" ? route.fulfill({ status: 422, json: { error: { code: "VALIDATION_FAILED" } } }) : route.fulfill({ json: { data: { items: [], limit: 100 } } }));
  await page.goto("/app/opportunities");
  await page.getByRole("button", { name: "Apply to Welder" }).click();
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText("You may already have applied, or it is your own listing.")).toBeVisible();
});

test("organization side: listings with applicant counts, review applicants, statuses persist and are re-read", async ({ page }) => {
  const rows: Row[] = [{ id: appId, applicantName: "Alice Applicant", message: "Two years of warehouse work.", status: "submitted", revision: 1, createdAt: "2026-11-10T09:00:00Z" }];
  const reviews: Record<string, unknown>[] = [];
  const counts = () => ({ submitted: rows.filter(r => r.status === "submitted").length, reviewing: rows.filter(r => r.status === "reviewing").length, shortlisted: rows.filter(r => r.status === "shortlisted").length, declined: rows.filter(r => r.status === "declined").length, withdrawn: rows.filter(r => r.status === "withdrawn").length });
  await setup(page, []);
  await page.route(/\/api\/v1\/applications(\?.*)?$/, route => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { id: string; status: string; expectedRevision: number }; reviews.push(body);
      const row = rows.find(item => item.id === body.id)!; row.status = body.status; row.revision += 1;
      return route.fulfill({ json: { data: { id: row.id, revision: row.revision, status: body.status } } });
    }
    if (url.searchParams.get("view") === "dashboard") return route.fulfill({ json: { data: { limit: 100, items: [{ listingId, title: "Welder", status: "published", expiresAt: "2027-01-01T00:00:00Z", counts: counts() }] } } });
    return route.fulfill({ json: { data: { listingId, listingTitle: "Welder", limit: 200, items: rows } } });
  });
  await page.goto("/app/applicants");
  await expect(page.getByLabel("My listings")).toContainText("Welder · Published · 1 applicant(s), 1 new, 0 shortlisted");
  await page.getByRole("button", { name: "Review applicants for Welder" }).click();
  const list = page.getByLabel("Applicants");
  await expect(list).toContainText("Alice Applicant · Submitted");
  await expect(list).toContainText("Two years of warehouse work.");
  await page.getByRole("button", { name: "Mark Alice Applicant as Shortlisted" }).click();
  await expect(list).toContainText("Alice Applicant · Shortlisted");
  expect(reviews[0]).toMatchObject({ action: "review", id: appId, status: "shortlisted", expectedRevision: 1 });
  await page.getByRole("button", { name: "Back to my listings" }).click();
  await expect(page.getByLabel("My listings")).toContainText("1 applicant(s), 0 new, 1 shortlisted");
  await expect(page.getByText("ORYQEN does not message applicants and does not verify anyone.")).toBeVisible();
});

test("organization sandbox (DEMO): both sides of the workflow on this device, labelled, persisted across reload, no real API calls", async ({ page }) => {
  const writes: string[] = [];
  await setup(page, []);
  await page.route(/\/api\/v1\/applications(\?.*)?$/, route => route.fulfill({ json: { data: { items: [], limit: 100 } } }));
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  await page.goto("/app/applicants");
  const sandbox = page.getByLabel("Organization sandbox (DEMO)");
  await expect(sandbox).toContainText("fictional applicants");
  await expect(sandbox).toContainText("nobody is verified");
  await sandbox.getByLabel("Your message to the sample organization (optional)").fill("Available immediately.");
  await sandbox.getByRole("button", { name: "Apply to the sample listing" }).click();
  await expect(sandbox).toContainText("Status set by the sample organization: Submitted.");
  await sandbox.getByRole("button", { name: "Organization view" }).click();
  await expect(sandbox).toContainText("5 sample applicant(s): 5 submitted, 0 reviewing, 0 shortlisted, 0 declined.");
  await expect(sandbox.getByLabel("Sample applicants")).toContainText("You, as a sample visitor (SAMPLE)");
  await sandbox.getByRole("button", { name: "Mark You, as a sample visitor (SAMPLE) as Shortlisted" }).click();
  await sandbox.getByRole("button", { name: "Mark Kasun Perera (SAMPLE) as Declined" }).click();
  await expect(sandbox).toContainText("5 sample applicant(s): 3 submitted, 0 reviewing, 1 shortlisted, 1 declined.");
  await page.reload();
  const again = page.getByLabel("Organization sandbox (DEMO)");
  await again.getByRole("button", { name: "Worker view" }).click();
  await expect(again).toContainText("Status set by the sample organization: Shortlisted.");
  await again.getByRole("button", { name: "Reset the sandbox" }).click();
  await expect(again.getByLabel("Your message to the sample organization (optional)")).toBeVisible();
  expect(writes).toEqual([]);
});

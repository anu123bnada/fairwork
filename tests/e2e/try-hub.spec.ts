import { expect, test } from "@playwright/test";

// The public /try page needs no account. These tests assert it works signed out, sends nothing to the server, links only to existing routes, and never claims verification.
test("visitor hub: worker, employer and recruiter experiences work with no account and make no API calls", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/")) apiCalls.push(`${request.method()} ${request.url()}`); });
  await page.goto("/try");
  await expect(page.getByText("EXHIBITION DEMO.")).toBeVisible();
  await expect(page.getByText("No account needed.").first()).toBeVisible();

  // Worker: the career explorer runs without sign-in and offers no account-only actions.
  await expect(page.getByText("SAMPLE DATA.").first()).toBeVisible();
  await page.getByRole("button", { name: "MIG welding" }).click();
  await page.getByLabel("Target role").selectOption("welder");
  await expect(page.locator(`div[aria-label="Skill gap"]`)).toContainText("33% of core skills covered");
  await expect(page.getByRole("button", { name: "Import skills from my latest CV" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Save a roadmap/ })).toHaveCount(0);
  await expect(page.getByText("Sign in to save a roadmap")).toBeVisible();
  await page.getByRole("button", { name: "Career assistant (DEMO)" }).click();
  await page.getByRole("button", { name: "What should I learn first?" }).click();
  await expect(page.getByLabel("Conversation")).toContainText("Start with");
  await page.getByRole("button", { name: "Salary comparison" }).click();
  await expect(page.getByText("ORYQEN holds no market salary dataset")).toBeVisible();

  // Employer: both sides of the applicant sandbox, fictional and labelled.
  await page.getByRole("button", { name: "I am an employer" }).click();
  const sandbox = page.getByLabel("Organization sandbox (DEMO)");
  await expect(sandbox).toContainText("fictional applicants");
  await sandbox.getByRole("button", { name: "Apply to the sample listing" }).click();
  await sandbox.getByRole("button", { name: "Organization view" }).click();
  await sandbox.getByRole("button", { name: "Mark Kasun Perera (SAMPLE) as Shortlisted" }).click();
  await expect(sandbox).toContainText("1 shortlisted");
  await expect(page.getByText("never granted from this page")).toBeVisible();

  // Recruiter: the wording check quotes what it matched and never gives a verdict.
  await page.getByRole("button", { name: "I am a recruiter" }).click();
  await page.getByRole("button", { name: "Paste a sample message (DEMO)" }).click();
  const indicators = page.getByLabel("Indicators");
  await expect(indicators).toContainText("Matched text:");
  await expect(indicators).toContainText("Payment requested before work or a contract");
  await page.getByLabel("Paste a recruiter message or job advertisement").fill("Please send your CV to our HR team for the warehouse role. Salary and hours are in the attached contract.");
  await expect(page.getByText("No indicators matched. This does not mean the message is safe")).toBeVisible();

  expect(apiCalls).toEqual([]);
});

test("the hub opens straight to a role and demo from the link, and the module guide lists all 22 modules with only working links", async ({ page, request }) => {
  await page.goto("/try?tab=recruiter&demo=check");
  await expect(page.getByLabel("Recruiter message check")).toBeVisible();
  await page.goto("/try?tab=employer&demo=org");
  await expect(page.getByLabel("Organization sandbox (DEMO)")).toBeVisible();
  await page.goto("/try?tab=worker&demo=salary");
  await expect(page.getByText("ORYQEN holds no market salary dataset")).toBeVisible();

  const guide = page.getByRole("table", { name: "Module guide" });
  await expect(guide.locator("tbody tr")).toHaveCount(22);
  await expect(guide).toContainText("Protected: it needs an authorized operator");
  await expect(guide).toContainText("The AI model is OFF on this build");
  await expect(guide).not.toContainText(/verified by ORYQEN|production ready|legally binding/i);
  const hrefs = await guide.locator("a").evaluateAll(links => [...new Set(links.map(link => link.getAttribute("href") ?? ""))]);
  expect(hrefs.length).toBeGreaterThan(10);
  for (const href of hrefs) {
    const path = href.split("?")[0]!;
    if (path.startsWith("/app/")) continue; // signed-in screens redirect for visitors; their existence is covered by the screen tests
    const response = await request.get(path);
    expect(response.status(), href).toBeLessThan(400);
  }
});

test("the landing page links to the visitor hub", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "TRY THE DEMO" }).first()).toBeVisible();
  await page.getByRole("link", { name: "TRY THE DEMO" }).first().click();
  await expect(page).toHaveURL(/\/try$/);
  await expect(page.getByText("EXHIBITION DEMO.")).toBeVisible();
});

test("phone layout: the hub has no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of ["/try", "/try?tab=employer&demo=org", "/try?tab=recruiter&demo=check"]) {
    await page.goto(url);
    await page.waitForTimeout(400);
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(widths.scroll, url).toBeLessThanOrEqual(widths.inner + 1);
  }
});

import { expect, test } from "@playwright/test";

test("cover letter generator builds a labelled template letter from typed words and stores nothing", async ({ page }) => {
  const writes: string[] = [];
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: "40000000-0000-4000-8000-000000000001", displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  await page.goto("/app/cover-letter");
  await expect(page.getByText("This is a template, not AI")).toBeVisible();
  const preview = page.getByLabel("Cover letter preview");
  await expect(preview).toContainText("Nimal Perera");
  await expect(page.getByText("Still empty: job, employer, strengths.")).toBeVisible();
  await page.getByLabel("Job you are applying for").fill("Welder");
  await page.getByLabel("Employer or organization").fill("Demo Steel Works");
  await page.getByLabel("Strength or skill 1").fill("MIG welding");
  await page.getByLabel("Strength or skill 2").fill("safe work");
  await expect(preview).toContainText("Dear Demo Steel Works hiring team,");
  await expect(preview).toContainText("apply for the Welder position at Demo Steel Works.");
  await expect(preview).toContainText("MIG welding and safe work");
  await expect(page.getByText("Still empty")).toHaveCount(0);
  await page.getByLabel("Style").selectOption("friendly");
  await expect(preview).toContainText("Hello Demo Steel Works team,");
  expect(writes).toEqual([]);
});

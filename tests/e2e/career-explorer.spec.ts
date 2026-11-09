import { expect, test } from "@playwright/test";
import { setup } from "./support/records-fake";

const cvId = "40000000-0000-4000-8000-000000000051";
test("career explorer: sample label, skill gap and roadmap update from ticked skills, persist on this device, and import CV skills", async ({ page }) => {
  const writes: string[] = [];
  await setup(page, []);
  await page.route(/\/api\/v1\/cv(\?.*)?$/, route => {
    const content = { basics: { fullName: "Nimal Perera", headline: "", email: "", phone: "", location: "", links: [] }, summary: "", education: [], experience: [], skills: ["Safe work", "Reading drawings"], projects: [], achievements: [], certifications: [], references: [], includeVerifiedWork: false };
    return route.fulfill({ json: { data: new URL(route.request().url()).searchParams.get("id") ? { id: cvId, title: "My CV", template: "modern", targetRole: "", content, revision: 1, updatedAt: "2026-11-09T10:00:00Z" } : { limit: 20, items: [{ id: cvId, title: "My CV", template: "modern", targetRole: "", revision: 1, updatedAt: "2026-11-09T10:00:00Z" }] } } });
  });
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  await page.goto("/app/career-explorer");
  await expect(page.getByText("SAMPLE DATA.")).toBeVisible();
  await expect(page.getByText("not real labour-market data").first()).toBeVisible();
  await page.getByLabel("Target role").selectOption("welder");
  const gap = page.locator(`div[aria-label="Skill gap"]`);
  await expect(gap).toContainText("0% of core skills covered");
  await page.getByRole("button", { name: "MIG welding" }).click();
  await page.getByRole("button", { name: "Reading drawings", exact: true }).click();
  await expect(gap).toContainText("67% of core skills covered");
  await expect(gap).toContainText("Missing core skills: Safe work");
  await expect(page.getByLabel("Roadmap steps")).toContainText("Take a basic workplace safety course");
  await page.getByRole("button", { name: "Import skills from my latest CV" }).click();
  await expect(page.getByText("Imported 2 skill(s) from your CV.")).toBeVisible();
  await expect(gap).toContainText("100% of core skills covered");
  await page.reload();
  await expect(page.getByLabel("Target role")).toHaveValue("welder");
  await expect(page.locator(`div[aria-label="Skill gap"]`)).toContainText("100% of core skills covered");
  expect(writes).toEqual([]);
});

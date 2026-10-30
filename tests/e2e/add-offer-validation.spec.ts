import { expect, test, type Page } from "@playwright/test";

const worker = "40000000-0000-4000-8000-000000000001";
const company = "40000000-0000-4000-8000-000000000002";
// Fixture browser checks only; no local or hosted database records are changed.
async function setup(page: Page, companies: "linked" | "empty" | "unavailable" = "linked") {
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => companies === "unavailable"
    ? route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } })
    : route.fulfill({ json: { data: { items: companies === "linked" ? [{ companyId: company, name: "Synthetic organization" }] : [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers", route => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ status: 403, json: { error: { code: "ACTION_FORBIDDEN" } } });
  });
  await page.goto("/app/add-offer");
  await expect(page.getByLabel("Role title", { exact: true })).toBeVisible();
  return writes;
}

test("paste mode exposes required fields and explains missing role without submitting", async ({ page }) => {
  const writes = await setup(page);
  await page.getByLabel("Paste offer text").fill("An offer with terms to review");
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  await expect(page.locator(".fw-error[role='alert']")).toContainText("Role title");
  await expect(page.getByLabel("Role title", { exact: true })).toBeFocused();
  expect(writes).toEqual([]);
});

test("new worker sees an honest empty organization state and a legitimate approval path", async ({ page }) => {
  const writes = await setup(page, "empty");
  await page.getByLabel("Role title", { exact: true }).fill("Picker");
  const draft=page.getByRole("region",{name:"Draft offer indicators"});
  await draft.getByRole("button",{name:"Check draft indicators"}).click();
  await expect(draft).toContainText("5/100");await expect(draft).toContainText("Unsaved draft");
  await page.getByLabel("Pay amount").fill("1200");
  await expect(draft).not.toContainText("5/100");await expect(draft.getByRole("status")).toContainText("Fields changed");
  await draft.getByRole("button",{name:"Check draft indicators"}).click();await expect(draft).toContainText("10/100");
  await expect(page.getByText(/No linked organizations found/)).toBeVisible();
  await expect(page.getByLabel("Worker account ID")).toHaveValue(worker);
  await expect(page.getByLabel("Worker account ID")).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  // A worker without an organization is no longer blocked: the rule-based analysis runs and is saved as a private draft (or the draft save error is shown).
  await expect(page.getByRole("region", { name: "Analysis result" }).or(page.locator(".fw-error[role='alert']"))).toBeVisible();
  await expect(page.locator(".fw-error[role='alert']")).not.toContainText("Select a linked organization");
  await expect(page.getByRole("link", { name: "Request independent organization approval" })).toHaveAttribute("href", "/app/employer");
  expect(writes).toEqual([]);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("selected company sends the signed-in worker and preserves server denial and draft text", async ({ page }) => {
  const writes = await setup(page);
  await page.getByLabel("Paste offer text").fill("Synthetic offer text retained for review");
  await page.getByLabel("Role title", { exact: true }).fill("Picker");
  await page.getByLabel("Company organization", { exact: true }).selectOption(company);
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  await expect(page.locator(".fw-error[role='alert']")).toContainText("not authorized");
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ companyId: company, workerId: worker, requesterRole: "WORKER", terms: { role: "Picker" }, expectedVersion: 1 });
  expect(writes[0]).not.toHaveProperty("requesterId");
  await expect(page.getByLabel("Paste offer text")).toHaveValue("Synthetic offer text retained for review");
  await expect(page).toHaveURL(/\/app\/add-offer$/);
});

test("unavailable company discovery fails visibly without issuing an offer command", async ({ page }) => {
  const writes = await setup(page, "unavailable");
  await expect(page.getByRole("alert").filter({ hasText: "Could not load your organizations" })).toBeVisible();
  await page.getByLabel("Role title", { exact: true }).fill("Picker");
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  expect(writes).toEqual([]);
});

test("employer must supply a distinct worker identifier and server authority remains decisive", async ({ page }) => {
  const writes = await setup(page);
  await page.getByLabel("Role title", { exact: true }).fill("Picker");
  await page.getByLabel("Company organization", { exact: true }).selectOption(company);
  await page.getByLabel("Your intended party role").selectOption("EMPLOYER");
  await expect(page.getByLabel("Worker account ID")).toHaveValue("");
  await page.getByLabel("Worker account ID").fill("not-a-worker-id");
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  await expect(page.locator(".fw-error[role='alert']")).toContainText("Worker account ID");
  expect(writes).toEqual([]);
  await page.getByLabel("Worker account ID").fill("40000000-0000-4000-8000-000000000003");
  await page.getByRole("button", { name: "Analyze offer", exact: true }).click();
  await expect(page.locator(".fw-error[role='alert']")).toContainText("not authorized");
  expect(writes[0]?.requesterRole).toBe("EMPLOYER");
});

test("pasted fictional terms fill visible controls, preserve edits and report no-match honestly", async ({ page }, testInfo) => {
  const writes = await setup(page);
  await page.getByLabel("Paste offer text").fill("We are hiring a Maintenance Technician at Example Workshop.\nSecurity deposit: LKR 5000\nSalary: LKR 85000 per month\n40 hrs/week\nStart date: 2026-11-01\nResponsibilities: Inspect equipment\nBenefits: Transport allowance");
  await page.getByRole("button", { name: "Suggest terms with local rules" }).click();
  await expect(page.getByLabel("Role title", { exact: true })).toHaveValue("Maintenance Technician");
  await expect(page.getByLabel("Pay amount")).toHaveValue("85000");
  await expect(page.getByLabel("Currency", { exact: true })).toHaveValue("LKR");
  await expect(page.getByRole("textbox", { name: "Pay period (optional)", exact: true })).toHaveValue("monthly");
  await expect(page.getByLabel("Expected hours per week")).toHaveValue("40");
  await expect(page.getByLabel("Start date", { exact: true })).toHaveValue("2026-11-01");
  await expect(page.getByRole("textbox", { name: "Responsibilities", exact: true })).toHaveValue("Inspect equipment");
  await expect(page.getByRole("textbox", { name: "Benefits (optional)", exact: true })).toHaveValue("Transport allowance");
  await page.screenshot({path:testInfo.outputPath("extracted-desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("extracted-mobile.png"),fullPage:true});
  await page.getByLabel("Pay amount").fill("90000");
  await page.getByRole("button", { name: "Suggest terms with local rules" }).click();
  await expect(page.getByLabel("Pay amount")).toHaveValue("90000");
  await expect(page.getByRole("status").filter({ hasText: "existing fields preserved" })).toBeVisible();
  await page.getByLabel("Paste offer text").fill("An exciting opportunity awaits.");
  await expect(page.getByText(/existing fields preserved/)).toHaveCount(0);
  await page.getByRole("button", { name: "Suggest terms with local rules" }).click();
  await expect(page.getByRole("status").filter({ hasText: "No supported, unambiguous terms" })).toBeVisible();
  expect(writes).toEqual([]);
});
test("editing preserves saved extension fields while explicitly cleared known fields are removed",async({page})=>{
 const writes=await setup(page);
 const offerId="40000000-0000-4000-8000-000000000004";
 await page.route("**/api/v1/agreements?*",route=>route.fulfill({json:{data:{offer:{offerId,companyId:company,workerId:worker,requesterId:worker,requesterRole:"WORKER",representativeId:null,version:1,termHash:"a".repeat(64),snapshot:{role:"Picker",benefits:"Transport",customReviewedClause:"Retain this saved condition"},changes:[],unresolved:[]},agreementId:"40000000-0000-4000-8000-000000000005",confirmation:null,answers:[],canConfirm:false}}}));
 await page.goto(`/app/add-offer?offerId=${offerId}`);
 await expect(page.getByLabel("Role title",{exact:true})).toHaveValue("Picker");
 await page.getByRole("textbox",{name:"Benefits (optional)",exact:true}).fill("");
 await page.getByRole("button",{name:"Analyze offer",exact:true}).click();
 await expect(page.locator(".fw-error[role='alert']")).toContainText("not authorized");
 expect(writes[0]?.terms).toMatchObject({role:"Picker",customReviewedClause:"Retain this saved condition"});
 expect(writes[0]?.terms).not.toHaveProperty("benefits");
});

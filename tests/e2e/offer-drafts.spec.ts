import { expect,test } from "@playwright/test";
import { translate } from "../../src/i18n";
test("private drafts save without an organization, reload and resume in the editor",async({page})=>{
 const id="40000000-0000-4000-8000-000000000001";
 let item:unknown=null;
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic Worker",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/companies**",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
 await page.route("**/api/v1/offers/drafts",route=>{
  if(route.request().method()==="POST"){const body=route.request().postDataJSON();expect(body).not.toHaveProperty("companyId");item={id:body.id,revision:1,content:body.content,savedAt:"2026-10-25T00:00:00Z"};return route.fulfill({json:{data:{id:body.id,revision:1,saved:true}}});}
  return route.fulfill({json:{data:{items:item?[item]:[],nextCursor:null}}});
 });
 await page.goto("/app/add-offer");
 await page.getByLabel("Role title",{exact:true}).fill("Draft technician");
 await page.getByLabel("Paste offer text",{exact:true}).fill("Salary: LKR 80000 monthly");
 await page.getByText("Private offer drafts — no organization required",{exact:true}).click();
 const copy=page.getByRole("button",{name:"Copy current offer text into a new private draft",exact:true});
 await copy.click();
 await expect(page.getByLabel("Draft role",{exact:true})).toHaveValue("Draft technician");
 await expect(page.getByLabel("Draft offer text",{exact:true})).toHaveValue("Salary: LKR 80000 monthly");
 await expect(copy).toBeDisabled();
 await page.getByLabel("Reported employer",{exact:true}).fill("Unverified company");
 await page.getByRole("button",{name:"Save private draft",exact:true}).click();await expect(page.getByText("Private draft saved · revision 1",{exact:true})).toBeVisible();
 await page.reload();await page.getByText("Private offer drafts — no organization required",{exact:true}).click();await page.getByRole("button",{name:"Edit draft",exact:true}).click();await expect(page.getByLabel("Draft offer text",{exact:true})).toHaveValue("Salary: LKR 80000 monthly");
 await page.getByLabel("Draft offer text",{exact:true}).fill("Unsaved edit must not replace saved evidence");
 await page.getByRole("button",{name:"Review saved draft",exact:true}).click();
 const review=page.getByRole("region",{name:"Saved private draft review"});
 await expect(review).toContainText("Draft technician · Revision 1");
 await expect(review).toContainText("Salary: LKR 80000 monthly");
 await expect(review).not.toContainText("Unsaved edit must not replace saved evidence");
 await expect(review.getByRole("region",{name:"Clause check"})).toContainText("No unclear, contradictory or suspicious wording was found");
 await review.getByRole("button",{name:"Check draft indicators"}).click();
 await expect(review).toContainText("Employer verification: not assessed");
 await page.getByRole("button",{name:"Use saved draft in a new offer",exact:true}).click();await expect(page.locator('input[name="role"]')).toHaveValue("Draft technician");
});

for (const locale of ["si","ta","de"] as const) {
 test(`the private drafts panel is translated in ${locale}`,async({page})=>{
  const id="40000000-0000-4000-8000-000000000001";
  await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic Worker",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
  await page.route("**/api/v1/companies**",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.route("**/api/v1/offers/drafts",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
  await page.goto("/app/settings");await page.getByLabel("Language").selectOption(locale);
  await page.goto("/app/add-offer");await page.getByText(translate(locale,"dr.summary"),{exact:true}).click();
  await expect(page.getByText(translate(locale,"dr.intro"))).toBeVisible();
  await expect(page.getByLabel(translate(locale,"dr.role"),{exact:true})).toBeVisible();
  await expect(page.getByText(translate(locale,"dr.none"))).toBeVisible();
  await expect(page.locator("details").filter({hasText:translate(locale,"dr.summary")})).not.toContainText(/\bdr\.[a-zA-Z.]+\b/);
 });
}

test("dashboard opens the exact saved draft and protects unsaved conflict edits",async({page})=>{
 const id="40000000-0000-4000-8000-000000000001";
 const draftId="40000000-0000-4000-8000-000000000002";
 let revision=1, failRead=false;
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic Worker",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/companies**",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
 await page.route("**/api/v1/offers/drafts",route=>{
  if(route.request().method()==="POST")return route.fulfill({status:409,json:{error:{code:"VERSION_CONFLICT"}}});
  if(failRead)return route.fulfill({status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}});
  return route.fulfill({json:{data:{items:[{id:draftId,revision,content:{role:"Private technician",employer:"Reported company",text:`Saved text revision ${revision}`},savedAt:"2026-10-30T00:00:00Z"}],nextCursor:null}}});
 });
 await page.goto("/app/home");
 const drafts=page.getByRole("region",{name:"Your private offer drafts"});
 await expect(drafts).toContainText("Self-reported");
 await drafts.getByRole("link",{name:"Open draft: Private technician"}).click();
 await expect(page.getByRole("region",{name:"Saved private draft review"})).toContainText("Saved text revision 1");
 await page.getByRole("button",{name:"Edit draft",exact:true}).click();
 await page.getByLabel("Draft offer text",{exact:true}).fill("Keep my unsaved changes");
 page.once("dialog",dialog=>dialog.dismiss());
 await page.getByRole("button",{name:"Start new draft",exact:true}).click();
 await expect(page.getByLabel("Draft offer text",{exact:true})).toHaveValue("Keep my unsaved changes");
 await page.getByRole("button",{name:"Save private draft",exact:true}).click();
 await expect(page.getByRole("alert").filter({hasText:"newer revision"})).toBeVisible();
 revision=2;failRead=true;
 await page.getByRole("button",{name:"Reload drafts",exact:true}).click();
 await expect(page.getByLabel("Draft offer text",{exact:true})).toHaveValue("Keep my unsaved changes");
 await expect(page.getByRole("region",{name:"Saved private draft review"})).toContainText("Saved text revision 1");
 failRead=false;
 await page.getByRole("button",{name:"Reload drafts",exact:true}).click();
 page.once("dialog",dialog=>dialog.accept());
 await page.getByRole("button",{name:"Edit draft",exact:true}).click();
 await expect(page.getByLabel("Draft offer text",{exact:true})).toHaveValue("Saved text revision 2");
});

test("a confirmed save remains reviewable when a later list read fails",async({page})=>{
 const id="40000000-0000-4000-8000-000000000001";let saved=false;
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic Worker",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/companies**",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
 await page.route("**/api/v1/offers/drafts",route=>{
  if(route.request().method()==="POST"){saved=true;return route.fulfill({json:{data:{id:route.request().postDataJSON().id,revision:1,saved:true}}});}
  return saved?route.fulfill({status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}}):route.fulfill({json:{data:{items:[],nextCursor:null}}});
 });
 await page.goto("/app/add-offer");await page.getByText("Private offer drafts — no organization required",{exact:true}).click();
 await page.getByLabel("Draft role",{exact:true}).fill("Saved role");
 await page.getByLabel("Draft offer text",{exact:true}).fill("Salary: LKR 90000 monthly");
 await page.getByRole("button",{name:"Save private draft",exact:true}).click();
 await expect(page.getByText("Private draft saved · revision 1",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Reload drafts",exact:true}).click();
 await page.getByRole("button",{name:"Review saved draft",exact:true}).click();
 await expect(page.getByRole("region",{name:"Saved private draft review"})).toContainText("Salary: LKR 90000 monthly");
});

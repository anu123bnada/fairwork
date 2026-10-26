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
 await page.goto("/app/add-offer");await page.getByText("Private offer drafts — no organization required",{exact:true}).click();
 await page.getByLabel("Draft role",{exact:true}).fill("Draft technician");await page.getByLabel("Reported employer",{exact:true}).fill("Unverified company");await page.getByLabel("Draft offer text",{exact:true}).fill("Salary: LKR 80000 monthly");
 await page.getByRole("button",{name:"Save private draft",exact:true}).click();await expect(page.getByText("Private draft saved · revision 1",{exact:true})).toBeVisible();
 await page.reload();await page.getByText("Private offer drafts — no organization required",{exact:true}).click();await page.getByRole("button",{name:"Edit draft",exact:true}).click();await expect(page.getByLabel("Draft offer text",{exact:true})).toHaveValue("Salary: LKR 80000 monthly");
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

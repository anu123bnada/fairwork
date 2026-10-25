import { expect,test } from "@playwright/test";
test("self-reported employment saves, reloads, edits to a new revision and never shows as verified",async({page})=>{
 const id="40000000-0000-4000-8000-000000000002";
 let item:Record<string,unknown>|null=null;const saves:Record<string,unknown>[]=[];
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic Worker",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/work-records**",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
 await page.route("**/api/v1/me/employment-history",route=>{
  if(route.request().method()==="POST"){const body=route.request().postDataJSON();saves.push(body);const revision=body.expectedRevision+1;
   item={id:body.id,revision,content:body.content,savedAt:"2026-10-25T00:00:00Z",verification:"self_reported"};
   return route.fulfill({json:{data:{id:body.id,revision,saved:true}}});}
  return route.fulfill({json:{data:{items:item?[item]:[],nextCursor:null}}});
 });
 await page.goto("/app/work-record");
 const region=page.getByRole("region",{name:"Self-reported employment history"});
 await expect(region.getByText(/Nothing here is verified/)).toBeVisible();
 await region.getByLabel("Employer",{exact:true}).fill("Synthetic Works Ltd");await region.getByLabel("Job title",{exact:true}).fill("Technician");
 await region.getByLabel("Start month",{exact:true}).fill("2021-03");await region.getByLabel("I currently work here").check();
 await expect(region.getByLabel("End month",{exact:true})).toHaveCount(0);
 await region.getByLabel("Skills (comma separated, up to 20)").fill("Welding, Safety");
 await region.getByRole("button",{name:"Add entry",exact:true}).click();
 await expect(region.getByText("Saved privately · revision 1",{exact:true})).toBeVisible();
 expect(saves[0]).toMatchObject({expectedRevision:0,content:{current:true,endDate:null,skills:["Welding","Safety"]}});
 await page.reload();
 await expect(region.getByRole("listitem")).toContainText("Technician");await expect(region.getByRole("listitem")).toContainText("Self-reported");
 await expect(region.getByRole("listitem")).not.toContainText(/verified/i);
 await region.getByRole("button",{name:"Edit entry",exact:true}).click();
 await region.getByLabel("I currently work here").uncheck();await region.getByLabel("End month",{exact:true}).fill("2023-06");
 await region.getByRole("button",{name:"Save new revision",exact:true}).click();
 await expect(region.getByText("Saved privately · revision 2",{exact:true})).toBeVisible();
 expect(saves[1]).toMatchObject({id:saves[0]!.id,expectedRevision:1,content:{current:false,endDate:"2023-06"}});
 await expect(region.getByRole("listitem")).toContainText("2021-03 – 2023-06");
});
test("an end month before the start is refused without a request",async({page})=>{
 const id="40000000-0000-4000-8000-000000000002";let posts=0;
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic Worker",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/work-records**",route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
 await page.route("**/api/v1/me/employment-history",route=>{if(route.request().method()==="POST")posts++;return route.fulfill({json:{data:{items:[],nextCursor:null}}});});
 await page.goto("/app/work-record");const region=page.getByRole("region",{name:"Self-reported employment history"});
 await region.getByLabel("Employer",{exact:true}).fill("Synthetic Works Ltd");await region.getByLabel("Job title",{exact:true}).fill("Technician");
 await region.getByLabel("Start month",{exact:true}).fill("2022-05");await region.getByLabel("End month",{exact:true}).fill("2021-01");
 await region.getByRole("button",{name:"Add entry",exact:true}).click();
 await expect(region.getByRole("alert")).toContainText("end month");expect(posts).toBe(0);
});

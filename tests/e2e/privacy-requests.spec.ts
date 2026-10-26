import { test, expect } from "@playwright/test";
import { translate } from "../../src/i18n";
test.use({ viewport: { width: 390, height: 844 } });
test("privacy request UI distinguishes submission from deletion and clears denied history", async ({ page }) => {
 const id="40000000-0000-4000-8000-000000000001";let saved=false,denied=false;
 const item={requestId:id,kind:"deletion",scope:"Synthetic account retention review",createdAt:"2026-10-18T00:00:00Z",revision:0,status:"received",history:[]};
 await page.route("**/api/v1/me",route=>route.fulfill({json:{data:{id,displayName:"Synthetic privacy owner",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
 await page.route("**/api/v1/privacy-requests",async route=>{
  if(denied)return route.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED"}}});
  if(route.request().method()==="POST"){
   expect(route.request().postDataJSON()).toEqual({operation:"create",kind:"deletion",scope:item.scope});
   expect(route.request().headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);saved=true;
   return route.fulfill({json:{data:item}});
  }
  return route.fulfill({json:{data:{items:saved?[item]:[],nextCursor:null}}});
 });
 await page.goto("/app/settings");await page.getByText("Manage privacy requests",{exact:true}).click();
 const section=page.getByRole("region",{name:"Privacy requests",exact:true});
 await section.getByLabel("Privacy request type").selectOption("deletion");await section.getByLabel("Request scope").fill(item.scope);
 await section.getByRole("button",{name:"Submit privacy request"}).click();
 await expect(section.getByText("Privacy request saved for manual review. Your account and records have not been changed.",{exact:true})).toBeVisible();
 await expect(section.getByText("deletion request · received",{exact:true})).toBeVisible();
 await expect(page.getByRole("region",{name:"Privacy review queue"})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 denied=true;await section.getByRole("button",{name:"Refresh privacy requests"}).click();
 await expect(section.getByRole("alert")).toBeVisible();await expect(section.getByText(item.scope,{exact:true})).toHaveCount(0);
});

for (const locale of ["si", "ta", "de"] as const) {
  test(`privacy requests and account security are translated in ${locale}`, async ({ page }) => {
    const id = "40000000-0000-4000-8000-000000000001";
    await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
    await page.route("**/api/v1/privacy-requests**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
    await page.route("**/api/v1/auth/mfa", route => route.fulfill({ json: { data: { factors: [] } } }));
    await page.goto("/app/settings"); await page.getByLabel("Language").selectOption(locale);
    await page.goto("/app/settings");
    await page.getByText(translate(locale, "set.privacy"), { exact: true }).click();
    await page.getByText(translate(locale, "set.security"), { exact: true }).click();
    const privacy = page.getByRole("region", { name: translate(locale, "pv.title"), exact: true });
    await expect(privacy).toContainText(translate(locale, "pv.intro"));
    await expect(privacy.getByRole("button", { name: translate(locale, "pv.submit") })).toBeVisible();
    await expect(privacy).toContainText(translate(locale, "pv.none"));
    await expect(page.getByRole("region", { name: translate(locale, "sec.aria") })).toContainText(translate(locale, "sec.intro"));
    await expect(page.locator("body")).not.toContainText(/\b(?:pv|sec)\.[a-zA-Z._]+\b/);
  });
}

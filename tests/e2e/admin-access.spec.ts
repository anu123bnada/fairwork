import {test,expect} from "@playwright/test";
const target="50000000-0000-4000-8000-000000000001";
test("direct audit links retain the real server access gate",async({page})=>{
 // No mocked identity or admin endpoint: the isolated build has no Auth config.
 await page.goto(`/admin/audit?target=${target}`);
 await expect(page.getByRole("heading",{name:"Secure access",exact:true})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Audit history",exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Administrative navigation")).toHaveCount(0);
});
test("malformed and repeated audit targets are unavailable in the built application",async({page})=>{
 for(const query of ["target=invalid",`target=${target}&target=${target}`]){
  await page.goto(`/admin/audit?${query}`);
  await expect(page.getByRole("heading",{name:"Page unavailable",exact:true})).toBeVisible();
  await expect(page.getByLabel("Administrative navigation")).toHaveCount(0);
 }
});

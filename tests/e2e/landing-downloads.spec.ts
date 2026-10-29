import { expect,test } from "@playwright/test";
import { androidRelease,windowsRelease } from "../../src/features/releases/releases";
for(const [name,width] of [["desktop",1440],["mobile",390]] as const){
 test(`landing download section shows real release facts with disabled controls (${name})`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/");
  const cards=page.locator("#download .release-card");await expect(cards).toHaveCount(2);
  for(const [index,release] of [windowsRelease,androidRelease].entries()){
   const card=cards.nth(index);
   await expect(card).toContainText(release.name);await expect(card).toContainText(release.version);
   await expect(card).toContainText(release.size.split(" (")[0]!);await expect(card).toContainText("PREVIEW · UNSIGNED");
   await expect(card.locator("code")).toHaveAttribute("title",release.sha256);
   if(release.key==="android"){await expect(card.locator("a[href$='.apk']")).toHaveAttribute("href","/downloads/ORYQEN-Online-Preview-1.0.0-staging-debug.apk");}
   else{await expect(card.getByRole("button",{name:new RegExp(`${release.name} release pending`,"i")})).toBeDisabled();await expect(card.locator("a[href]")).toHaveCount(0);}
  }
  await expect(page.getByRole("link",{name:/Release details/i})).toHaveAttribute("href","/downloads");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
 });
}
test("downloads page uses the same facts and offers no binary link without a configured URL",async({page})=>{
 await page.goto("/downloads");
 for(const release of [windowsRelease,androidRelease]){await expect(page.getByText(release.sha256)).toBeVisible();}
 await expect(page.getByRole("button",{name:/Windows download — release pending/})).toBeDisabled();
 await expect(page.locator('a[href$=".exe"],a[href$=".msi"]')).toHaveCount(0);
 await expect(page.locator('a[href$=".apk"]')).toHaveAttribute("href","/downloads/ORYQEN-Online-Preview-1.0.0-staging-debug.apk");
});

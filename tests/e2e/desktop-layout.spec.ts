import { expect, test } from '@playwright/test';
for (const width of [320,375,390,430,768,1024,1280,1440,1920]) test(`product uses real window layout at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  await page.route('**/api/v1/me', route => route.fulfill({json:{data:{id:'40000000-0000-4000-8000-000000000001',displayName:'Synthetic worker',locale:'en',timeZone:'UTC',revision:1,capabilities:[]}}}));
  await page.route('**/api/v1/guidance**', route => route.fulfill({json:{data:{threadId:null,threads:[],turns:[],providerAvailable:false}}}));
  await page.goto('/app/guidance');
  await expect(page.getByRole('region',{name:'Private guidance'})).toBeVisible();
  await expect(page.locator('.fw-product > .fw-device-status')).toBeHidden();
  const frame = await page.locator('.fw-product').boundingBox();
  expect(frame!.width).toBeGreaterThanOrEqual(width - 2);
  if(width>=768) {
    const nav=await page.getByRole('navigation',{name:'Main navigation'}).boundingBox();
    expect(nav!.height).toBeGreaterThan(800); expect(nav!.width).toBeLessThan(200);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if([390,1440].includes(width)) await page.screenshot({path:`test-results/v4-layout-${width}.png`,fullPage:true});
});

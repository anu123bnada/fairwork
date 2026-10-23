import { test, expect } from "@playwright/test";

// Real on-device OCR of a generated synthetic image. Only session/API transport
// is intercepted; the OCR worker, WASM and English language data are real.
test("English screenshot is read locally and reviewed text populates offer fields", async ({ page }) => {
  test.setTimeout(90000);
  await page.route("**/api/v1/**", route => route.fulfill({status:503,json:{error:{code:"SERVICE_UNAVAILABLE"}}}));
  await page.route("**/api/v1/me", route => route.fulfill({json:{data:{id:"40000000-0000-4000-8000-000000000001",displayName:"Synthetic",locale:"en",timeZone:"UTC",revision:1,capabilities:[]}}}));
  await page.goto("/app/add-offer");
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");canvas.width=1000;canvas.height=400;
    const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,1000,400);
    ctx.fillStyle="black";ctx.font="32px Arial";
    ["Role: Technician", "Salary: LKR 85000 per month", "40 hours per week"].forEach((line,i)=>ctx.fillText(line,40,65+i*70));
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  const externalRequests:string[]=[];
  page.on("request",request=>{if(new URL(request.url()).origin!==new URL(page.url()).origin&&request.url().startsWith("http"))externalRequests.push(request.url());});
  await page.getByRole("tab",{name:"Screenshot",exact:true}).click();
  await page.getByLabel("Offer screenshot").setInputFiles({name:"synthetic-offer.png",mimeType:"image/png",buffer:Buffer.from(image,"base64")});
  await expect(page.getByRole("textbox",{name:"Review extracted text"})).toHaveValue(/Technician/,{timeout:50000});
  await page.getByRole("button",{name:"Use reviewed text"}).click();
  await page.getByRole("button",{name:"Suggest terms with local rules"}).click();
  await expect(page.getByLabel("Role title",{exact:true})).toHaveValue("Technician");
  await expect(page.getByLabel("Pay amount")).toHaveValue("85000");
  await expect(page.getByLabel("Expected hours per week")).toHaveValue("40");
  expect(externalRequests).toEqual([]);
});

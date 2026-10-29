import { expect, test, type Page } from "@playwright/test";

// Real on-device parsing and OCR of generated synthetic documents. Only session and API transport is intercepted.
const worker = "40000000-0000-4000-8000-000000000001";
async function setup(page: Page) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  await page.route("**/api/v1/offers/drafts**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/offers/analyze", route => route.fulfill({ json: { data: { configured: false, provider: null, model: null, noticeVersion: "offer-analysis.v1", processingRegion: null, dataUse: null, policyHash: null, fallbacks: [], availability: [] } } }));
}

// Minimal valid PDF with a real cross-reference table. Each page is either text or one JPEG image (a scan).
function buildPdf(pages: Array<{ text: string[] } | { jpeg: Buffer; width: number; height: number }>): Buffer {
  const objects: Buffer[] = [];
  const add = (body: string | Buffer) => { objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1")); return objects.length; };
  const catalog = add(""), tree = add("");
  const kids: number[] = [];
  for (const page of pages) {
    const w = "jpeg" in page ? page.width : 600, h = "jpeg" in page ? page.height : 300;
    let content: number, resources: string;
    if ("jpeg" in page) {
      const image = add(Buffer.concat([Buffer.from(`<</Type/XObject/Subtype/Image/Width ${page.width}/Height ${page.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${page.jpeg.length}>>\nstream\n`, "latin1"), page.jpeg, Buffer.from("\nendstream", "latin1")]));
      const stream = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
      content = add(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
      resources = `<</XObject<</Im0 ${image} 0 R>>>>`;
    } else {
      const stream = `BT /F1 14 Tf 20 ${h - 40} Td 20 TL ${page.text.map(line => `(${line}) Tj T*`).join(" ")} ET`;
      content = add(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
      const font = add("<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>");
      resources = `<</Font<</F1 ${font} 0 R>>>>`;
    }
    kids.push(add(`<</Type/Page/Parent ${tree} 0 R/MediaBox[0 0 ${w} ${h}]/Contents ${content} 0 R/Resources${resources}>>`));
  }
  objects[catalog - 1] = Buffer.from(`<</Type/Catalog/Pages ${tree} 0 R>>`, "latin1");
  objects[tree - 1] = Buffer.from(`<</Type/Pages/Kids[${kids.map(k => `${k} 0 R`).join(" ")}]/Count ${kids.length}>>`, "latin1");
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets: number[] = [];
  let position = parts[0]!.length;
  objects.forEach((body, index) => {
    offsets.push(position);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
    parts.push(chunk); position += chunk.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Size ${objects.length + 1}/Root ${catalog} 0 R>>\nstartxref\n${position}\n%%EOF`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}

async function jpegOf(page: Page, lines: string[]): Promise<Buffer> {
  const data = await page.evaluate(lines => {
    const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 400;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1000, 400);
    ctx.fillStyle = "black"; ctx.font = "32px Arial";
    lines.forEach((line, index) => ctx.fillText(line, 40, 65 + index * 70));
    return canvas.toDataURL("image/jpeg", 0.95).split(",")[1]!;
  }, lines);
  return Buffer.from(data, "base64");
}

test("a scanned PDF is read page by page with on-device OCR, marked by page, quality-checked and analysed with page references", async ({ page }) => {
  test.setTimeout(180000);
  await setup(page);
  await page.goto("/app/add-offer");
  const external: string[] = [];
  page.on("request", request => { if (request.url().startsWith("http") && new URL(request.url()).origin !== new URL(page.url()).origin) external.push(request.url()); });
  const first = await jpegOf(page, ["Job offer: Store Keeper", "Salary: LKR 70000 per month", "40 hours per week"]);
  const second = await jpegOf(page, ["Staff who resign early must repay", "the training bond in full.", "Notice period: one month"]);
  const pdf = buildPdf([{ jpeg: first, width: 1000, height: 400 }, { jpeg: second, width: 1000, height: 400 }]);

  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  await page.getByLabel("Offer PDF").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByText("probably a scan")).toBeVisible();
  await page.getByRole("button", { name: "Read scanned pages on this device" }).click();
  const review = page.getByRole("textbox", { name: "Review extracted text" });
  await expect(review).toHaveValue(/\[Page 2\]/, { timeout: 150000 });
  await expect(review).toHaveValue(/\[Page 1\]/);
  await expect(review).toHaveValue(/Store Keeper/);
  await expect(page.getByRole("status", { name: "Reading quality" })).toContainText("Check this text carefully");
  await expect(page.getByRole("status", { name: "Reading quality" })).toContainText("Text read from an image can contain mistakes");
  await page.getByRole("button", { name: "Use this text" }).click();
  await page.getByRole("button", { name: "Suggest terms with local rules" }).click();
  const clauses = page.getByRole("region", { name: "Clause check" });
  await expect(clauses).toContainText("Penalty for leaving");
  await expect(clauses).toContainText("page 2");
  expect(external).toEqual([]);
});

test("a multi-page text PDF carries page markers and an unreadable scan reports a truthful error", async ({ page }) => {
  await setup(page);
  await page.goto("/app/add-offer");
  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  const input = page.getByLabel("Offer PDF");
  await input.setInputFiles({ name: "offer.pdf", mimeType: "application/pdf", buffer: buildPdf([{ text: ["Salary LKR 90000 per month", "Working 40 hours per week every week"] }, { text: ["The employer may change these terms at any time without notice."] }]) });
  const review = page.getByRole("textbox", { name: "Review extracted text" });
  await expect(review).toHaveValue(/\[Page 1\][\s\S]*Salary LKR 90000[\s\S]*\[Page 2\][\s\S]*without notice/);
  await page.getByRole("button", { name: "Use this text" }).click();
  await page.getByRole("button", { name: "Suggest terms with local rules" }).click();
  await expect(page.getByRole("region", { name: "Clause check" })).toContainText("Terms can be changed without notice");
  await expect(page.getByRole("region", { name: "Clause check" })).toContainText("page 2");

  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  await input.setInputFiles({ name: "blank.pdf", mimeType: "application/pdf", buffer: buildPdf([{ text: [] }]) });
  await expect(page.getByText("probably a scan")).toBeVisible();
  await page.getByRole("button", { name: "Read scanned pages on this device" }).click();
  await expect(page.locator("p[role=alert]").filter({ hasText: "No text could be read from the scanned pages" })).toBeVisible({ timeout: 90000 });
});

test("qualifications are compared with the job from the person's own text and LinkedIn export files, without verification claims", async ({ page }) => {
  await setup(page);
  await page.goto("/app/add-offer");
  await page.getByLabel("Paste offer text").fill("Warehouse Supervisor\nRequirements:\n- 3+ years of experience in stores\n- Forklift licence\n- Diploma in logistics\n- Strong communication skills\nBenefits:\n- Transport allowance");
  const panel = page.locator("details", { hasText: "Compare my qualifications with this job" });
  await panel.locator("summary").click();
  await expect(panel.getByText("not connected to LinkedIn")).toBeVisible();
  await panel.getByLabel("LinkedIn data export files").setInputFiles([
    { name: "Positions.csv", mimeType: "text/csv", buffer: Buffer.from('Company Name,Title,Description,Location,Started On,Finished On\nBeta Stores,Store Keeper,Stock control,Kandy,Jan 2018,Dec 2022\n') },
    { name: "Skills.csv", mimeType: "text/csv", buffer: Buffer.from("Name\nForklift licence\nInventory control\n") },
    { name: "Connections.csv", mimeType: "text/csv", buffer: Buffer.from("First Name,Last Name\nA,B\n") },
  ]);
  await expect(panel.getByRole("status").filter({ hasText: "Added text from your export" })).toContainText("1 file(s) were not recognised");
  await expect(panel.getByLabel("My skills, education and experience")).toHaveValue(/Experience: Store Keeper at Beta Stores/);
  await panel.getByRole("button", { name: "Compare", exact: true }).click();
  const result = panel.getByLabel("Qualification comparison result");
  await expect(result).toContainText("does not verify any qualification");
  await expect(result.getByText("Where your own words match the requirements")).toBeVisible();
  await expect(result).toContainText("Forklift licence");
  await expect(result.getByText("Possible gaps and what to do")).toBeVisible();
  await expect(result).toContainText("Diploma in logistics");
  await expect(result).toContainText("Strong communication skills");
  await expect(result).not.toContainText("verified by");
});

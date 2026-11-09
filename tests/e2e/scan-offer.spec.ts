import { expect, test, type Page } from "@playwright/test";

// Real on-device reading of a generated synthetic image: the reader, its WebAssembly and language data are real. Only the session and the AI-configuration answer are fixtures.
const id = "40000000-0000-4000-8000-000000000001";
const FILE_LABEL = "Offer screenshot (PNG or JPEG, up to 5 MB)";
const aiConfig = (configured: boolean) => configured
  ? { configured: true, provider: "gemini", model: "gemini-synthetic-test", noticeVersion: "offer-analysis.v1", processingRegion: "Region A (synthetic)", dataUse: "Synthetic fixture text", policyHash: "a".repeat(64), fallbacks: [], availability: [{ provider: "gemini", role: "primary", state: "available", retryAfterSeconds: 0 }] }
  : { configured: false, provider: null, model: null, noticeVersion: "offer-analysis.v1", processingRegion: null, dataUse: null, policyHash: null, fallbacks: [], availability: [] };

async function setup(page: Page, configured = false, posts: string[] = []) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Visitor", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/offers/analyze", route => {
    if (route.request().method() === "POST") { posts.push(route.request().url()); return route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }); }
    return route.fulfill({ json: { data: aiConfig(configured) } });
  });
  await page.goto("/app/scan");
  await expect(page.getByLabel("Scan an offer", { exact: true })).toBeVisible();
}
async function offerImage(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1100; canvas.height = 560;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1100, 560); ctx.fillStyle = "black"; ctx.font = "30px Arial";
    ["Role: Technician", "Salary: LKR 85000 per month", "40 hours per week", "You must pay a registration fee of LKR 5000", "before you start. Guaranteed visa for everyone."]
      .forEach((line, i) => ctx.fillText(line, 40, 70 + i * 75));
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  return Buffer.from(base64, "base64");
}

test("a screenshot is scanned with real stages, then shown as a report with findings, the text read, and clear limits", async ({ page }) => {
  test.setTimeout(170000);
  await setup(page);
  const external: string[] = [];
  page.on("request", request => { if (request.url().startsWith("http") && new URL(request.url()).origin !== new URL(page.url()).origin) external.push(request.url()); });
  await page.getByLabel(FILE_LABEL).setInputFiles({ name: "synthetic-offer.png", mimeType: "image/png", buffer: await offerImage(page) });

  const dialog = page.getByRole("dialog", { name: "Scanning your offer" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel scan" })).toBeVisible();
  await expect(page.locator('[data-stage="image"][data-state="done"]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-stage="read"][data-state="active"]')).toBeVisible({ timeout: 20000 });

  const report = page.getByLabel("Offer scan report", { exact: true });
  await expect(report).toBeVisible({ timeout: 140000 });
  await expect(dialog).toHaveCount(0);
  await expect(report.getByLabel("Executive summary")).toContainText("characters were read");
  await expect(report.getByLabel("Executive summary")).toContainText("AI analysis is not configured");
  await expect(report.getByLabel("Text read from the screenshot")).toHaveValue(/Technician/);
  await expect(report.getByLabel("Confidence and limitations")).toContainText("not legal advice");
  await expect(report.getByLabel("Executive summary").locator("li").first()).toBeVisible();
  expect(external).toEqual([]);

  // Correcting a misread word is possible, and the text carries into the normal offer flow.
  await report.getByRole("button", { name: "Continue with this offer" }).click();
  await expect(page).toHaveURL(/\/app\/add-offer$/);
  await expect(page.getByLabel("Paste offer text")).toHaveValue(/Technician/);
});

test("when AI is configured the scan says so but sends nothing until the person consents", async ({ page }) => {
  test.setTimeout(170000);
  const posts: string[] = [];
  await setup(page, true, posts);
  await page.getByLabel(FILE_LABEL).setInputFiles({ name: "synthetic-offer.png", mimeType: "image/png", buffer: await offerImage(page) });
  const report = page.getByLabel("Offer scan report", { exact: true });
  await expect(report).toBeVisible({ timeout: 140000 });
  await expect(report.getByLabel("Executive summary")).toContainText("AI analysis is configured");
  await expect(report.getByRole("checkbox").first()).not.toBeChecked();
  expect(posts).toEqual([]);
});

test("a file that is not really an image stops at the first stage with a plain message, and can be closed", async ({ page }) => {
  await setup(page);
  await page.getByLabel(FILE_LABEL).setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("this is not an image at all, just text") });
  const dialog = page.getByRole("dialog", { name: "The scan stopped" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-stage="image"][data-state="failed"]')).toBeVisible();
  await expect(dialog).toContainText("could not be opened");
  await expect(dialog.locator('[data-stage="read"][data-state="pending"]')).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Offer scan report", { exact: true })).toHaveCount(0);
});

test("cancelling while the text is being read stops the scan and shows no report", async ({ page }) => {
  test.setTimeout(90000);
  await setup(page);
  await page.getByLabel(FILE_LABEL).setInputFiles({ name: "synthetic-offer.png", mimeType: "image/png", buffer: await offerImage(page) });
  const dialog = page.getByRole("dialog", { name: "Scanning your offer" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel scan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(page.getByLabel("Offer scan report", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(FILE_LABEL)).toBeEnabled();
});

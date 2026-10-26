import { expect, test, type Page } from "@playwright/test";

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SHA = "ab".repeat(32);
const row = (n: number, title: string) => ({ documentId: id(n), title, category: "certificate", fileName: "certificate.pdf", mediaType: "application/pdf", byteSize: 20480, sha256: SHA, createdAt: "2026-10-27T08:00:00Z" });

async function signedIn(page: Page, storageConfigured = true) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/work-records**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/me/employment-history**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/companies**", route => route.fulfill({ json: { data: { items: [], scope: "your_authorized_organizations", externalSourceConfigured: false } } }));
  return { storageConfigured };
}

test("a worker saves, downloads and deletes a private document, with an honest unconfigured state", async ({ page }) => {
  let items = [row(10, "Existing letter")]; const uploads: Record<string, unknown>[] = []; let deleted = "";
  await signedIn(page);
  await page.route("**/api/v1/vault", async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postData() ?? "";
      uploads.push({ type: route.request().headers()["content-type"]?.split(";")[0], hasFile: body.includes('name="file"'), key: /name="idempotencyKey"\r\n\r\n([0-9a-f-]{36})/.exec(body)?.[1], title: /name="title"\r\n\r\n([^\r]*)/.exec(body)?.[1] });
      items = [row(11, "Welding certificate"), ...items];
      return route.fulfill({ json: { data: { documentId: id(11), replayed: false } } });
    }
    return route.fulfill({ json: { data: { items, limit: 50, used: items.length, storageConfigured: true } } });
  });
  await page.route("**/api/v1/vault/link**", route => route.fulfill({ json: { data: { url: "http://localhost:3101/api/v1/vault/blob?token=signed", expiresAt: "2026-10-27T08:01:00Z" } } }));
  await page.route("**/api/v1/vault/blob**", route => route.fulfill({ status: 200, headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="certificate.pdf"' }, body: "%PDF-1.7 synthetic" }));
  await page.route("**/api/v1/vault/delete", route => { deleted = route.request().postDataJSON().documentId; items = items.filter(item => item.documentId !== deleted); return route.fulfill({ json: { data: { documentId: deleted, fileRemoved: true } } }); });
  await page.goto("/app/work-record");
  const vault = page.getByRole("region", { name: "Evidence Vault" });
  await expect(vault).toContainText("Only you can see them"); await expect(vault).toContainText("Existing letter"); await expect(vault).toContainText("1 of 50 documents used");
  await expect(vault).toContainText("not scanned for malware");
  await vault.getByLabel("Document title").fill("Welding certificate");
  await vault.getByLabel(/File \(PDF/).setInputFiles({ name: "weld cert.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 synthetic certificate") });
  await vault.getByRole("button", { name: "Save document" }).click();
  await expect(vault.getByRole("status").filter({ hasText: "saved privately" })).toBeVisible(); await expect(vault).toContainText("Welding certificate");
  expect(uploads).toHaveLength(1); expect(uploads[0]).toMatchObject({ type: "multipart/form-data", hasFile: true, title: "Welding certificate" }); expect(uploads[0]!.key).toMatch(/^[0-9a-f-]{36}$/);
  const download = page.waitForEvent("download");
  await vault.getByRole("listitem").filter({ hasText: "Welding certificate" }).getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toBe("certificate.pdf");
  const item = vault.getByRole("listitem").filter({ hasText: "Existing letter" });
  await item.getByRole("button", { name: "Delete" }).click(); expect(deleted).toBe("");
  await expect(item.getByRole("group", { name: "Confirm deleting" })).toBeVisible();
  await item.getByRole("button", { name: "Keep" }).click(); await expect(vault).toContainText("Existing letter");
  await item.getByRole("button", { name: "Delete" }).click(); await item.getByRole("button", { name: "Delete now" }).click();
  await expect(vault).not.toContainText("Existing letter"); expect(deleted).toBe(id(10));
});

test("an unconfigured server says so and disables uploads", async ({ page }) => {
  await signedIn(page);
  await page.route("**/api/v1/vault", route => route.request().method() === "GET"
    ? route.fulfill({ json: { data: { items: [], limit: 50, used: 0, storageConfigured: false } } })
    : route.fulfill({ status: 415, json: { error: { code: "UNSUPPORTED_MEDIA_TYPE" } } }));
  await page.goto("/app/work-record");
  const vault = page.getByRole("region", { name: "Evidence Vault" });
  await expect(vault).toContainText("Document storage is not set up on this server yet");
  await vault.getByLabel("Document title").fill("Anything");
  await expect(vault.getByRole("button", { name: "Save document" })).toBeDisabled();
});

test("the vault holds on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page);
  await page.route("**/api/v1/vault", route => route.fulfill({ json: { data: { items: [row(10, "A very long document title that should wrap instead of forcing the page wider than the screen")], limit: 50, used: 1, storageConfigured: true } } }));
  await page.goto("/app/work-record");
  await expect(page.getByRole("region", { name: "Evidence Vault" })).toContainText("A very long document title");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

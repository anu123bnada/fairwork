import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { translate } from "../../src/i18n";

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("a person downloads a file of their own records, with secrets left out and unreadable sections named", async ({ page }) => {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/credentials", route => route.fulfill({ json: { data: { signingConfigured: true, verifyBase: "http://localhost/verify", items: [{ credentialId: id(5), status: "valid", expiresAt: "2027-01-01T00:00:00Z", token: "SECRET.TOKEN.VALUE" }] } } }));
  await page.route("**/api/v1/offers?*", route => route.fulfill({ json: { data: { items: [{ offerId: id(2), role: "Welder", version: 1 }], nextCursor: null } } }));
  await page.route("**/api/v1/offers/analyses?*", route => route.fulfill({ json: { data: { offerId: id(2), items: [] } } }));
  await page.route("**/api/v1/work-records", route => route.fulfill({ json: { data: { items: [{ workId: id(3), hours: "8" }], nextCursor: null } } }));
  await page.goto("/app/settings");
  await page.getByText("Download my data").first().click();
  const panel = page.getByRole("region", { name: "Download my data" });
  await expect(panel).toContainText("It is not uploaded anywhere");
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Create and download my data file" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^oryqen-data-export-\d{4}-\d{2}-\d{2}\.json$/);
  const body = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(body.format).toBe("oryqen-data-export.v1");
  expect(body.sections.profile).toMatchObject({ status: "ok" });
  expect(body.sections.workRecords.data.items).toEqual([{ workId: id(3), hours: "8" }]);
  expect(body.sections.savedAnalyses.status).toBe("ok");
  expect(JSON.stringify(body)).not.toContain("SECRET.TOKEN.VALUE"); expect(body.sections.credentials.data.items[0].credentialId).toBe(id(5));
  expect(body.sections.evidenceVaultDocuments.status).toBe("unavailable"); expect(body.sections.guidance.status).toBe("unavailable");
  await expect(panel.getByRole("status")).toContainText("Your file was created"); await expect(panel.getByRole("status")).toContainText("could not be read");
});

test("the export panel is translated and holds on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: id(1), displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.goto("/app/settings");
  await page.getByLabel("Language").selectOption("ta");
  await page.getByText(translate("ta", "export.title")).first().click();
  const panel = page.getByRole("region", { name: translate("ta", "export.title") });
  await expect(panel).toContainText(translate("ta", "export.intro"));
  await expect(panel.getByRole("button", { name: translate("ta", "export.button") })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

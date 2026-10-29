import { expect, test, type Page } from "@playwright/test";
import { translate, type LocaleCode } from "../../src/i18n";

const worker = "40000000-0000-4000-8000-000000000012", rep = "40000000-0000-4000-8000-000000000013", id = "40000000-0000-4000-8000-000000000021", company = "40000000-0000-4000-8000-000000000001";
const time = "2026-10-14T01:00:00+00:00", hash = "a".repeat(64), evidenceHash = "b".repeat(64);
const record = {
  workId: id, agreementId: id, workerId: worker, companyId: company, representativeId: rep, currentVersion: 1,
  versions: [{
    version: 1, state: "draft", contentHash: hash, evidenceHash, createdAt: time, submittedAt: null, decision: null,
    content: { schemaVersion: "work-record.v1", agreement: { id, version: 1, contentHash: hash, authorityDecisionId: company, effectiveAt: time, scope: "Engineering" }, role: "Engineer", periodStart: "2026-10-12", periodEnd: "2026-10-12", hours: "8", tasks: "Maintenance completed", evidence: [{ id: company, ownerId: worker, text: "Maintenance log checked", recordedAt: time }] },
  }],
};

async function session(page: Page, withRecord: boolean) {
  await page.route("**/api/v1/**", route => route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: worker, displayName: "Synthetic participant", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/me/employment-history**", route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route("**/api/v1/vault", route => route.fulfill({ json: { data: { items: [], limit: 50, used: 0, storageConfigured: false } } }));
  await page.route("**/api/v1/work-records**", route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("workId")) return route.fulfill({ json: { data: record } });
    return route.fulfill({ json: { data: { items: withRecord ? [{ workId: id, version: 1, state: "draft", hours: "8", periodStart: "2026-10-12", periodEnd: "2026-10-12" }] : [], nextCursor: null } } });
  });
}

for (const locale of ["si", "ta", "de"] as LocaleCode[]) {
  test(`the work record screen is translated in ${locale}: empty state, form and record details`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await session(page, false);
    await page.goto("/app/settings");
    await page.getByLabel("Language").selectOption(locale);
    await page.goto("/app/work-record");
    await expect(page.getByText(translate(locale, "work.emptyTitle"))).toBeVisible();
    await expect(page.getByText(translate(locale, "work.emptyBody"))).toBeVisible();
    await expect(page.getByText(translate(locale, "work.eyebrow"))).toBeVisible();
    await page.getByRole("button", { name: translate(locale, "work.logWork"), exact: true }).first().click();
    const form = page.locator("form.fw-offer-detail-card");
    // A new record picks its agreement from the agreement chooser (covered by the agreement-picker tests); the free-text id appears only when editing an existing record.
    for (const key of ["work.role", "work.periodStart", "work.periodEnd", "work.hours", "work.performed"] as const) await expect(form.getByText(translate(locale, key), { exact: false }).first(), `${locale}:${key}`).toBeVisible();
    await expect(form.getByRole("button", { name: translate(locale, "work.loadBasis") })).toBeVisible();
    await expect(form.getByRole("button", { name: translate(locale, "work.savePrivate") })).toBeVisible();
    await expect(form.getByText(translate(locale, "work.evidenceNote"))).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\bwork\.[a-zA-Z.]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${locale} overflow`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`work-form-${locale}.png`), fullPage: true });

    await page.unroute("**/api/v1/work-records**");
    await page.route("**/api/v1/work-records**", route => {
      const url = new URL(route.request().url());
      return route.fulfill({ json: { data: url.searchParams.has("workId") ? record : { items: [{ workId: id, version: 1, state: "draft", hours: "8", periodStart: "2026-10-12", periodEnd: "2026-10-12" }], nextCursor: null } } });
    });
    await page.goto(`/app/work-record?workId=${id}`);
    const details = page.getByRole("region", { name: translate(locale, "work.detailsAria") });
    await expect(details.getByRole("status")).toContainText(translate(locale, "work.recordVersion", { version: 1, state: translate(locale, "work.state.draft") }));
    await expect(details).toContainText(translate(locale, "work.reportConcern")); await expect(details).toContainText(translate(locale, "work.scope", { scope: "Engineering" }));
    await expect(details).toContainText(translate(locale, "work.textEvidence")); await expect(details.getByRole("button", { name: translate(locale, "work.editDraft") })).toBeVisible();
    await expect(details.getByText(translate(locale, "work.shareCheck"))).toBeVisible(); await expect(details.getByRole("button", { name: translate(locale, "work.submit") })).toBeVisible();
  });
}

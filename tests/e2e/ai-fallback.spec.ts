import { expect, test, type Page } from "@playwright/test";
import { extractOfferTermsRuleBased } from "../../src/features/offer/deterministic-extractor";

// Browser-only transport fixtures. No external model call and no privacy approval is involved.
const me = { data: { id: "40000000-0000-4000-8000-000000000001", displayName: "Synthetic", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } };
const config = (paused: boolean) => ({
  configured: true, provider: "gemini", model: "gemini-synthetic-test", noticeVersion: "offer-analysis.v1", processingRegion: "Region A (fixture)", dataUse: "Fixture only; no transmission", policyHash: "a".repeat(64),
  fallbacks: [{ provider: "openai", model: "gpt-synthetic", processingRegion: "Region B (fixture)", dataUse: "Other fixture terms", policyHash: "b".repeat(64) }],
  availability: [{ provider: "gemini", role: "primary", state: paused ? "paused" : "available", retryAfterSeconds: paused ? 900 : 0 }, { provider: "openai", role: "fallback", state: "available", retryAfterSeconds: 0 }],
});
async function open(page: Page, paused: boolean, reply: Record<string, unknown>, bodies: Record<string, unknown>[]) {
  await page.route("**/api/v1/me", route => route.fulfill({ json: me }));
  await page.route("**/api/v1/offers/analyze", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: config(paused) } });
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { data: reply } });
  });
  await page.goto("/app/add-offer");
  await page.getByLabel("Paste offer text").fill("Role: Technician\nSalary: LKR 85000 monthly\n40 hours per week");
}

test("a backup provider is used only when the person ticks it, and the answer says which providers were tried", async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await open(page, false, { configured: true, provider: "openai", status: "SUCCESS", message: "Offer analyzed successfully using OpenAI.", isAdvisory: true, extractedAt: "2026-10-27T00:00:00Z", data: extractOfferTermsRuleBased("Role: Technician\nSalary: LKR 85000 monthly").data, attempts: [{ provider: "gemini", outcome: "quota" }, { provider: "openai", outcome: "success" }] }, bodies);
  const group = page.getByRole("group", { name: "Backup providers" });
  await expect(group).toContainText("Region B (fixture)"); await expect(group.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox", { name: /I reviewed this text/ }).check();
  await page.getByRole("button", { name: "Send for AI analysis" }).click();
  await expect(page.getByText("Providers tried: Google Gemini (quota reached), OpenAI (answered).")).toBeVisible();
  expect(bodies[0]!.consent).toEqual({ provider: "gemini", noticeVersion: "offer-analysis.v1", policyHash: "a".repeat(64), transmit: true }); // no fallback key without a tick
  await group.getByRole("checkbox", { name: /Also allow OpenAI/ }).check();
  await page.getByRole("checkbox", { name: /I reviewed this text/ }).check();
  await page.getByRole("button", { name: "Send for AI analysis" }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]!.consent).toMatchObject({ provider: "gemini", fallbacks: [{ provider: "openai", policyHash: "b".repeat(64) }] });
});

test("a paused provider is explained, and an exhausted quota gives a retry time without queuing the text", async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await open(page, true, { configured: true, provider: "gemini", status: "RATE_LIMITED", message: "AI provider quota or rate limit reached. No automatic retry was made. Check the account quota before retrying. Automatic analysis is paused for about 15 minutes so the exhausted quota is not retried.", isAdvisory: true, extractedAt: "2026-10-27T00:00:00Z", data: null, retryAfterSeconds: 900, attempts: [{ provider: "gemini", outcome: "paused" }] }, bodies);
  await expect(page.getByRole("status").filter({ hasText: "Google Gemini is paused for about 15 minutes" })).toContainText("Nothing is sent to a provider while it is paused");
  await page.getByRole("checkbox", { name: /I reviewed this text/ }).check();
  await page.getByRole("button", { name: "Send for AI analysis" }).click();
  await expect(page.getByText("Try AI again in about 15 minutes. Your text was not saved or queued")).toBeVisible();
  await expect(page.getByText("Providers tried: Google Gemini (paused, nothing sent).")).toBeVisible();
  await expect(page.getByLabel("Role title")).toBeVisible(); // the deterministic form keeps working
});

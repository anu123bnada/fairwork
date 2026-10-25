import { translate } from "../../src/i18n";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

// Browser transport fixtures only. No demo data or bypass is added to the app.
const worker = "40000000-0000-4000-8000-000000000001";
const employer = "40000000-0000-4000-8000-000000000002";
const offerId = "40000000-0000-4000-8000-000000000003";
const agreementId = "40000000-0000-4000-8000-000000000004";
const questionId = "40000000-0000-4000-8000-000000000006";
const question = "What core responsibilities are still unresolved?";
const offer = {
  offerId, companyId: "40000000-0000-4000-8000-000000000005", workerId: worker,
  requesterId: employer, requesterRole: "EMPLOYER", representativeId: employer,
  version: 1, termHash: "a".repeat(64), changes: [],
  snapshot: { role: "Motorcycle Technician", salary: 50000, currency: "LKR", startDate: "2026-11-01", hoursPerWeek: 40 },
  unresolved: [{ id: questionId, field: "responsibilities", question, required: true }],
};

async function identity(page: Page) {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: {
    id: worker, displayName: "Synthetic Worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [],
  } } }));
}

test("visual evidence uses populated saved states and keeps real confirmation gates", async ({ page }) => {
  test.slow();
  await identity(page);
  let answered = false;
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: {
    offer, agreementId, answers: answered ? [{ questionId, answer: "Service brakes and maintain motorcycles.", answeredBy: employer }] : [],
    confirmation: null, canConfirm: answered,
  } } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const measurements: unknown[] = [];
  mkdirSync("test-results/day3-visual/after", { recursive: true });
  for (const size of [{ width: 390, height: 844 }, { width: 378, height: 744 }]) {
    await page.setViewportSize(size);
    for (const screen of ["home", "analyzing", "check", "questions", "agreement"]) {
      await page.goto(`/app/${screen}?offerId=${offerId}`);
      await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
      await expect(page.getByText(screen === "home" ? "Good morning, Synthetic" : screen === "questions" ? question : screen === "analyzing" ? "Checking 5 offer details" : screen === "check" ? "Some details need clarification" : "Agreement summary", { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (screen === "agreement") await expect(page.getByRole("button", { name: /Confirm these terms/ })).toBeDisabled();
      if (screen !== "home") await expect(page.locator(".fw-fixed-action")).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/day3-visual/after/${size.width}-${screen}-populated.png`, animations: "disabled" });
      await page.screenshot({ path: `test-results/day3-visual/after/${size.width}-${screen}-full.png`, animations: "disabled", fullPage: true });
      measurements.push({ size, screen, metrics: await page.locator(".fw-product").evaluate(el => ({
        background: getComputedStyle(el).backgroundImage, height: el.getBoundingClientRect().height,
        font: getComputedStyle(el).fontFamily,
        cards: [...el.querySelectorAll(".fw-card,.fw-term-card,.fw-question-card")].map(card => ({
          class: card.className, bounds: card.getBoundingClientRect().toJSON(),
          blur: getComputedStyle(card).backdropFilter, shadow: getComputedStyle(card).boxShadow,
        })),
      })) });
    }
  }
  answered = true;
  await page.reload();
  await expect(page.getByRole("button", { name: /Confirm these terms/ })).toBeEnabled();
  await expect(page.getByText("Service brakes and maintain motorcycles.")).toBeVisible();
  await page.screenshot({ path: "test-results/day3-visual/after/378-agreement-answered.png", fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
  writeFileSync("test-results/day3-visual/after/measurements.json", JSON.stringify(measurements, null, 2));
});

test("language Back restores the third original onboarding slide and invalid slides are safe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/intro/language");
  await page.getByRole("button", { name: /Sinhala/ }).click();
  // Sinhala is now a real, partially translated locale: the status is shown in Sinhala and says so.
  await expect(page.getByRole("status")).toHaveText(translate("si", "language.selected", { language: "සිංහල" }));
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Build your Work Passport" })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/intro\/language$/);
  await page.goto("/intro/onboarding?slide=999");
  await expect(page.getByRole("heading", { name: "See what’s clear" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".fw-onboarding-art")).toHaveCSS("animation-name", "none");
});

test("copy questions copies only real generated questions and reports clipboard failure", async ({ page, context }) => {
  await identity(page);
  await page.route("**/api/v1/agreements?*", route => route.fulfill({ json: { data: {
    offer, agreementId, answers: [], confirmation: null, canConfirm: false,
  } } }));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/app/questions?offerId=${offerId}`);
  await page.getByRole("button", { name: "Copy questions" }).click();
  await expect(page.getByRole("status")).toHaveText("Questions copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(question);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error("Permission denied"); }; });
  await page.getByRole("button", { name: "Copy questions" }).click();
  await expect(page.getByRole("status")).toContainText("Could not copy");
  await expect(page.getByRole("button", { name: /Continue to agreement/ })).toBeDisabled();
});

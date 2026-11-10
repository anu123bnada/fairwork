import { expect, test } from "@playwright/test";
import { setup } from "./support/records-fake";

test("salary comparison: no market data claim, own reference points, offer position, limits flagged, kept on this device, no network writes", async ({ page }) => {
  const writes: string[] = [];
  await setup(page, []);
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  await page.goto("/app/salary");
  await expect(page.getByText("ORYQEN holds no market salary dataset")).toBeVisible();
  await expect(page.getByText("No reference point uses LKR.")).toBeVisible();

  // An invalid point is refused with a visible reason.
  await page.getByRole("button", { name: "Add reference point" }).click();
  await expect(page.getByText("Enter a short description, an amount above zero and a 3-letter currency.")).toBeVisible();

  // Real points the person found, with sources.
  const add = async (label: string, amount: string, extra: { date?: string; country?: string } = {}) => {
    await page.getByLabel("Where it came from (short description)").fill(label);
    await page.getByLabel("Pay amount").fill(amount);
    if (extra.country) await page.getByLabel("Country").fill(extra.country);
    if (extra.date) await page.getByLabel("Date of the source").fill(extra.date);
    await page.getByRole("button", { name: "Add reference point" }).click();
  };
  await add("Ad on a jobs board", "50000", { date: "2026-09", country: "Sri Lanka" });
  await add("Colleague said", "60000", { date: "2026-10", country: "Sri Lanka" });
  await expect(page.getByLabel("Reference points")).toContainText("Ad on a jobs board · 50,000 LKR / month · Job advertisement · 2026-09");
  await page.getByLabel("Offered pay", { exact: true }).fill("55000");
  const result = page.getByLabel("Comparison result");
  await expect(result).toContainText("Based on 2 of your own point(s) in LKR per month: lowest 50,000, median 55,000, highest 60,000.");
  await expect(result).toContainText("is within the range of your points");
  await expect(result).toContainText("This describes your list only, not the market.");
  await expect(page.getByLabel("Limits of this comparison")).toContainText("Only 2 point(s): fewer than 5");

  // Sample points are labelled and flagged; a different currency is left out, never converted.
  await page.getByRole("button", { name: "Add sample points (DEMO)" }).click();
  await expect(page.getByLabel("Limits of this comparison")).toContainText("6 point(s) are invented SAMPLE data and say nothing about real pay.");
  await expect(page.getByLabel("Reference points")).toContainText("SAMPLE (invented)");
  await page.getByLabel("Currency (3 letters)").first().fill("USD");
  await expect(result).toContainText("No reference point uses USD.");
  await page.getByLabel("Currency (3 letters)").first().fill("LKR");

  // Kept on this device across a reload; removing works; nothing was written to the server.
  await page.reload();
  await expect(page.getByLabel("Reference points").getByRole("listitem")).toHaveCount(8);
  await expect(page.getByLabel("Offered pay", { exact: true })).toHaveValue("55000");
  await page.getByRole("button", { name: "Remove Colleague said" }).click();
  await expect(page.getByLabel("Reference points").getByRole("listitem")).toHaveCount(7);
  expect(writes).toEqual([]);
});

import { expect, test, type Page } from "@playwright/test";

const id = "40000000-0000-4000-8000-000000000001";
async function open(page: Page) {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic Visitor", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.goto("/app/help");
  await expect(page.getByLabel("Help assistant", { exact: true })).toBeVisible();
}

test("the help assistant is labelled as not AI and answers from its written guide with links", async ({ page }) => {
  await open(page);
  await expect(page.getByText("Not AI. It answers from a written guide")).toBeVisible();
  const log = page.getByRole("log", { name: "Conversation with the help assistant" });
  await expect(log).toContainText("I can only answer from my written guide");
  await page.getByRole("button", { name: "How do I add a job offer?" }).click();
  await expect(log).toContainText("Suggest terms with local rules");
  await expect(log.getByRole("link", { name: "Add offer" })).toHaveAttribute("href", "/app/add-offer");
  await page.getByLabel("Your question").fill("why is the AI analysis not working");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(log).toContainText("switched off on purpose");
  await expect(log).not.toContainText("powered by AI");
  await page.getByLabel("Your question").fill("how can I make a CV");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(log.getByRole("link", { name: "CV Builder" }).last()).toHaveAttribute("href", "/app/cv");
});

test("it says it does not know instead of guessing, offers topics, and can be cleared", async ({ page }) => {
  await open(page);
  await page.getByLabel("Your question").fill("what is the capital of France");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const log = page.getByRole("log", { name: "Conversation with the help assistant" });
  await expect(log).toContainText("I do not have an answer for that in my guide");
  await expect(log.getByRole("button", { name: "What is not available yet?" })).toBeVisible();
  await log.getByRole("button", { name: "What is not available yet?" }).click();
  await expect(log).toContainText("planned, not available");
  await expect(log).toContainText("AI Challenge Arena");
  await page.getByRole("button", { name: "Clear conversation" }).click();
  await expect(log).not.toContainText("capital of France");
  await expect(page.getByRole("button", { name: "Clear conversation" })).toBeDisabled();
});

test("asking questions makes no network request and a script in the question is shown as plain text", async ({ page }) => {
  await open(page);
  const requests: string[] = [];
  page.on("request", request => { if (/\/api\//.test(request.url())) requests.push(request.url()); });
  await page.getByLabel("Your question").fill("<img src=x onerror=alert(1)> how do I share my passport");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const log = page.getByRole("log", { name: "Conversation with the help assistant" });
  await expect(log).toContainText("<img src=x onerror=alert(1)>");
  await expect(log).toContainText("named person who may see it");
  expect(await page.locator(".oq-help-log img").count()).toBe(0);
  expect(requests).toEqual([]);
});

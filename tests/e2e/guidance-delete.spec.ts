import { expect, test } from "@playwright/test";
const id = "40000000-0000-4000-8000-000000000001";
test("a guidance conversation can be permanently deleted only after explicit confirmation", async ({ page }) => {
  let threadId: string | null = null, deletes = 0;
  const turns: unknown[] = [];
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/guidance**", route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (body.operation === "delete") { deletes++; const count = turns.length; turns.length = 0; const deleted = threadId; threadId = null; return route.fulfill({ json: { data: { threadId: deleted, deleted: count } } }); }
      threadId = body.threadId;
      turns.push({ ordinal: turns.length + 1, question: body.question, topic: body.topic, createdAt: "2026-10-26T00:00:00Z", response: { mode: "rules", text: "Save work notes privately first.", source: "ORYQEN product guide", sourceVersion: "guidance.v1", destination: "/app/work-record", context: null } });
    }
    return route.fulfill({ json: { data: { threadId, turns, threads: threadId ? [{ id: threadId, updatedAt: "2026-10-26T00:00:00Z" }] : [], providerAvailable: false } } });
  });
  await page.goto("/app/guidance");
  await expect(page.getByRole("button", { name: "Delete this conversation" })).toHaveCount(0);
  await page.getByLabel("Your question").fill("How do I record work?");
  await page.getByRole("button", { name: "Save question and get guidance" }).click();
  await expect(page.getByText("How do I record work?")).toBeVisible();
  await page.getByRole("button", { name: "Delete this conversation" }).click();
  await expect(page.getByRole("button", { name: "Permanently delete this conversation" })).toBeVisible();
  expect(deletes).toBe(0);
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByText("How do I record work?")).toBeVisible(); expect(deletes).toBe(0);
  await page.getByRole("button", { name: "Delete this conversation" }).click();
  await page.getByRole("button", { name: "Permanently delete this conversation" }).click();
  await expect(page.getByText(/Conversation deleted/)).toBeVisible();
  await expect(page.getByText("How do I record work?")).toHaveCount(0);
  await expect(page.getByText("No messages in this conversation yet.")).toBeVisible();
  expect(deletes).toBe(1);
});
test("a failed deletion is reported as an error and the conversation stays", async ({ page }) => {
  const threadId = "40000000-0000-4000-8000-0000000000b2";
  const turn = { ordinal: 1, question: "Keep me", topic: "offer", createdAt: "2026-10-26T00:00:00Z", response: { mode: "rules", text: "General guidance.", source: "ORYQEN product guide", sourceVersion: "guidance.v1", destination: "/app/home", context: null } };
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id, displayName: "Synthetic worker", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/guidance**", route => route.request().method() === "POST"
    ? route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE" } } })
    : route.fulfill({ json: { data: { threadId, turns: [turn], threads: [{ id: threadId, updatedAt: "2026-10-26T00:00:00Z" }], providerAvailable: false } } }));
  await page.goto(`/app/guidance?threadId=${threadId}`);
  await page.getByRole("button", { name: "Delete this conversation" }).click();
  await page.getByRole("button", { name: "Permanently delete this conversation" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(/not available.*try again/i);
  await expect(page.getByText(/Conversation deleted/)).toHaveCount(0);
  await expect(page.getByText("Keep me")).toBeVisible();
});

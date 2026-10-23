import { expect, test } from "@playwright/test";

test("offer sandbox sends identity-free commands for answers, agreement and amendments", async ({ page }) => {
  const questionId = "40000000-0000-4000-8000-000000000051";
  const offerId = "40000000-0000-4000-8000-000000000021";
  const reviewRequests: Record<string, unknown>[] = [];
  const answerRequests: Record<string, unknown>[] = [];
  const confirmationRequests: Record<string, unknown>[] = [];

  await page.route("**/api/v1/offers", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    reviewRequests.push(body);
    return route.fulfill({
      json: {
        data: {
          offerId,
          companyId: body.companyId,
          workerId: body.workerId,
          requesterRole: body.requesterRole,
          requesterId: "server-derived-actor",
          version: body.expectedVersion,
          termHash: "a".repeat(64),
          unresolved: body.expectedVersion === 1
            ? [{ id: questionId, field: "salary", question: "What is the final salary?", required: true }]
            : [],
        },
      },
    });
  });
  await page.route("**/api/v1/offers/answers", async (route) => {
    answerRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ json: { data: { questionId, idempotent: false } } });
  });
  await page.route("**/api/v1/agreements", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    confirmationRequests.push(body);
    return route.fulfill({
      json: {
        data: {
          agreementId: body.agreementId,
          offerId,
          version: body.expectedVersion,
          confirmedBy: confirmationRequests.length === 1 ? "employer-session" : "worker-session",
          confirmationRole: body.confirmationRole,
          currentHash: "a".repeat(64),
          status: confirmationRequests.length === 1 ? "awaiting_other_party" : "confirmed",
        },
      },
    });
  });

  await page.goto("/day3");
  await expect(page.getByRole("heading", { name: "ORYQEN Day 3 developer sandbox" })).toBeVisible();
  await expect(page.getByLabel("Requester ID")).toHaveCount(0);
  await page.getByRole("button", { name: "Submit offer review" }).click();
  await expect(page.getByText("What is the final salary?")).toBeVisible();

  await page.getByLabel("Answer").fill("120000 USD annually");
  await page.getByRole("button", { name: "Record answer" }).click();
  await expect(page.getByText("Answer recorded for this offer revision.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm as employer" }).click();
  await expect(page.getByText("Waiting for the other independently authenticated party.")).toBeVisible();

  await page.getByLabel("Party role to request").selectOption("WORKER");
  await page.getByRole("button", { name: "Confirm as worker" }).click();
  await expect(page.getByText("Agreement confirmed by both parties.")).toBeVisible();

  await page.getByRole("button", { name: "Submit offer amendment" }).click();
  expect(reviewRequests.map((request) => request.expectedVersion)).toEqual([1, 2]);
  expect(answerRequests).toEqual([{
    offerId,
    offerVersion: 1,
    questionId,
    answer: "120000 USD annually",
    idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
  }]);
  expect(reviewRequests.every((request) => !("requesterId" in request))).toBe(true);
  expect(confirmationRequests).toHaveLength(2);
  expect(confirmationRequests[0]?.agreementId).toBe(confirmationRequests[1]?.agreementId);
  for (const request of confirmationRequests) {
    expect(request).not.toHaveProperty("confirmedBy");
    expect(request).not.toHaveProperty("previousHash");
    expect(request).not.toHaveProperty("currentHash");
    expect(request).not.toHaveProperty("unresolved");
  }
});

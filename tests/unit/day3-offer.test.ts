import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ offerCommand: vi.fn() }));
vi.mock("@/server/offer", () => ({ offerCommand: mocks.offerCommand }));
import { POST as reviewOffer } from "@/app/api/v1/offers/route";
import { POST as answerOfferQuestion } from "@/app/api/v1/offers/answers/route";
import { POST as confirmAgreementRoute } from "@/app/api/v1/agreements/route";
import {
  buildManualOfferReview,
  confirmAgreement,
  computeOfferHash,
  diffOfferTerms,
  deriveUnresolvedQuestions,
} from "@/features/offer/schema";

const companyId = "40000000-0000-4000-8000-000000000001";
const workerId = "40000000-0000-4000-8000-000000000002";
const offerId = "40000000-0000-4000-8000-000000000003";
const agreementId = "40000000-0000-4000-8000-000000000004";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  mocks.offerCommand.mockImplementation(async (command: string, payload: Record<string, unknown>) => {
    if (command === "review_offer") {
      const terms = payload.terms as Record<string, string | number>;
      return {
        offerId: payload.offerId,
        companyId: payload.companyId,
        workerId: payload.workerId,
        requesterId: "server-derived-actor",
        requesterRole: payload.requesterRole,
        version: payload.expectedVersion,
        snapshot: terms,
        termHash: computeOfferHash(terms),
        unresolved: [],
      };
    }
    return {
      agreementId: payload.agreementId,
      offerId: payload.offerId,
      version: payload.expectedVersion,
      confirmedBy: "server-derived-actor",
      confirmationRole: payload.confirmationRole,
      status: "awaiting_other_party",
    };
  });
});

describe("Day 3 manual offer review", () => {
  it("computes a stable hash and only resolves when required terms are complete", () => {
    const terms = {
      salary: 120000,
      currency: "USD",
      startDate: "2027-01-15",
      hoursPerWeek: 40,
      responsibilities: "Ship the MVP and review churn risk.",
    };
    const review = buildManualOfferReview({
      offerId,
      companyId,
      workerId,
      requesterRole: "EMPLOYER",
      terms,
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    }, companyId);

    expect(review.termHash).toBe(computeOfferHash(terms));
    expect(review.unresolved).toEqual([]);
  });

  it("finds unresolved questions and a deterministic diff for salary changes", () => {
    const original = {
      salary: 100000,
      currency: "USD",
      startDate: "2027-01-15",
      hoursPerWeek: 40,
      responsibilities: "Design and implement",
    };
    const next = {
      salary: 110000,
      currency: "USD",
      startDate: "2027-01-15",
      hoursPerWeek: 40,
      responsibilities: "Design and implement",
    };

    expect(diffOfferTerms(original, next)).toEqual([
      { field: "salary", previous: "100000", current: "110000" },
    ]);

    const incomplete = {
      salary: 0,
      currency: "USD",
      startDate: "2027-01-15",
      hoursPerWeek: 40,
      responsibilities: "",
    };
    const questions = deriveUnresolvedQuestions(incomplete);
    expect(questions.map((question) => question.field)).toEqual(["salary", "responsibilities"]);
  });

  it("builds terms without treating client identity as authorization", () => {
    const review = buildManualOfferReview({
      offerId,
      companyId,
      workerId,
      requesterRole: "WORKER",
      terms: {
        salary: 120000,
        currency: "USD",
        startDate: "2027-01-15",
        hoursPerWeek: 40,
        responsibilities: "Build the product.",
      },
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    }, workerId);
    expect(review.requesterId).toBe(workerId);
    expect(confirmAgreement({
      agreementId, offerId, companyId, workerId, confirmationRole: "WORKER",
      expectedVersion: 1, idempotencyKey: crypto.randomUUID(),
    }, workerId, review.termHash, "awaiting_other_party")).toMatchObject({ confirmedBy: workerId });
  });

  it("sends offer and agreement commands to the database RPC boundary", async () => {
    const terms = {
      salary: 98000,
      currency: "USD",
      startDate: "2027-02-01",
      hoursPerWeek: 38,
      responsibilities: "Refine the final offer language.",
    };
    const reviewRequest = new Request("http://localhost:3000/api/v1/offers", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        offerId,
        companyId,
        workerId,
        requesterRole: "EMPLOYER",
        terms,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    });

    const reviewResponse = await reviewOffer(reviewRequest);
    expect(reviewResponse.status).toBe(200);
    expect(mocks.offerCommand).toHaveBeenLastCalledWith("review_offer", expect.objectContaining({ offerId, companyId, workerId }));

    const agreementRequest = new Request("http://localhost:3000/api/v1/agreements", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agreementId,
        offerId,
        companyId,
        workerId,
        confirmationRole: "EMPLOYER",
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    });

    const agreementResponse = await confirmAgreementRoute(agreementRequest);
    expect(agreementResponse.status).toBe(200);
    const agreementResult = (await agreementResponse.json()).data;
    expect(mocks.offerCommand).toHaveBeenLastCalledWith("confirm_agreement", expect.objectContaining({ agreementId, offerId, companyId, workerId }));
    expect(agreementResult.status).toBe("awaiting_other_party");
  });

  it("confirms through the database using persisted agreement state", async () => {
    const terms = {
      salary: 98000,
      currency: "USD",
      startDate: "2027-02-01",
      hoursPerWeek: 38,
      responsibilities: "Refine the final offer language.",
    };
    const reviewRequest = new Request("http://localhost:3000/api/v1/offers", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        offerId,
        companyId,
        workerId,
        requesterRole: "EMPLOYER",
        terms,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    });

    const reviewResponse = await reviewOffer(reviewRequest);
    expect(reviewResponse.status).toBe(200);
    const review = (await reviewResponse.json()).data;
    expect(review.termHash).toBe(computeOfferHash(terms));

    const agreementRequest = new Request("http://localhost:3000/api/v1/agreements", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agreementId,
        offerId,
        companyId,
        workerId,
        confirmationRole: "EMPLOYER",
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    });

    const agreementResponse = await confirmAgreementRoute(agreementRequest);
    expect(agreementResponse.status).toBe(200);
    expect((await agreementResponse.json()).data.status).toBe("awaiting_other_party");
    const [, payload] = mocks.offerCommand.mock.calls.at(-1)!;
    expect(payload).not.toHaveProperty("currentHash");
    expect(payload).not.toHaveProperty("confirmedBy");
  });

  it("rejects identity and hash authority fields at the API boundary", async () => {
    const response = await reviewOffer(new Request("http://localhost:3000/api/v1/offers", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({
        offerId, companyId, workerId, requesterId: companyId, requesterRole: "EMPLOYER",
        terms: { salary: 1 }, expectedVersion: 1, idempotencyKey: crypto.randomUUID(),
      }),
    }));
    expect(response.status).toBe(422);

    const confirmation = await confirmAgreementRoute(new Request("http://localhost:3000/api/v1/agreements", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({
        agreementId, offerId, companyId, workerId, confirmedBy: companyId,
        confirmationRole: "EMPLOYER", previousHash: "a".repeat(64), currentHash: "a".repeat(64),
        expectedVersion: 1, idempotencyKey: crypto.randomUUID(),
      }),
    }));
    expect(confirmation.status).toBe(422);
  });

  it("routes question answers to the database command", async () => {
    const response = await answerOfferQuestion(new Request("http://localhost:3000/api/v1/offers/answers", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({
        offerId, offerVersion: 1, questionId: crypto.randomUUID(), answer: "Confirmed", idempotencyKey: crypto.randomUUID(),
      }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.offerCommand).toHaveBeenLastCalledWith("answer_offer_question", expect.objectContaining({ offerId }));
  });
});

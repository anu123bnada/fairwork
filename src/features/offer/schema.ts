import { createHash } from "node:crypto";
import { z } from "zod";

export const offerRoleSchema = z.enum(["EMPLOYER", "WORKER"]);
export const offerTermValueSchema = z.union([
  z.string().trim().min(1).max(500),
  z.number().finite().min(0.01).max(Number.MAX_SAFE_INTEGER),
]);
export const offerTermMapSchema = z.record(
  z.string().trim().min(1).max(80),
  offerTermValueSchema,
);

export const manualOfferRequestSchema = z.strictObject({
  offerId: z.uuid(),
  companyId: z.uuid(),
  workerId: z.uuid(),
  requesterRole: offerRoleSchema,
  terms: offerTermMapSchema,
  expectedVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: z.uuid(),
});

export const unresolvedQuestionSchema = z.strictObject({
  id: z.string().min(1).max(80),
  field: z.string().min(1).max(80),
  question: z.string().min(1).max(200),
  required: z.boolean(),
});

export const agreementConfirmationSchema = z.strictObject({
  agreementId: z.uuid(),
  offerId: z.uuid(),
  companyId: z.uuid(),
  workerId: z.uuid(),
  confirmationRole: offerRoleSchema,
  expectedVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: z.uuid(),
});

export const answerOfferQuestionSchema = z.strictObject({
  offerId: z.uuid(),
  offerVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  questionId: z.uuid(),
  answer: z.string().trim().min(1).max(2000),
  idempotencyKey: z.uuid(),
});

export type OfferTerms = Record<string, string | number>;
export type ManualOfferRequest = z.infer<typeof manualOfferRequestSchema>;
export type AgreementConfirmation = z.infer<typeof agreementConfirmationSchema>;
export type OfferQuestionAnswer = z.infer<typeof answerOfferQuestionSchema>;
export type UnresolvedQuestion = z.infer<typeof unresolvedQuestionSchema>;

const DEFAULT_REQUIRED_FIELDS = [
  "salary",
  "currency",
  "startDate",
  "hoursPerWeek",
  "responsibilities",
] as const;

const questionText: Record<string, string> = {
  salary: "What is the final salary amount for this offer?",
  currency: "Which currency applies to the salary?",
  startDate: "When does the work or start date begin?",
  hoursPerWeek: "What is the expected weekly hours?",
  responsibilities: "What core responsibilities are still unresolved?",
};

export function normalizeOfferTerms(terms: OfferTerms): Record<string, string> {
  return Object.fromEntries(
    Object.entries(terms)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : String(value)]),
  );
}

export function computeOfferHash(terms: OfferTerms): string {
  const normalized = normalizeOfferTerms(terms);
  return createHash("sha256").update(JSON.stringify(normalized), "utf8").digest("hex");
}

export function diffOfferTerms(prev: OfferTerms, next: OfferTerms) {
  const previous = normalizeOfferTerms(prev);
  const current = normalizeOfferTerms(next);
  const fields = new Set([...Object.keys(previous), ...Object.keys(current)]);
  return [...fields]
    .sort((left, right) => left.localeCompare(right))
    .filter((field) => previous[field] !== current[field])
    .map((field) => ({
      field,
      previous: previous[field] ?? null,
      current: current[field] ?? null,
    }));
}

export function deriveUnresolvedQuestions(
  terms: OfferTerms,
  requiredFields: readonly string[] = DEFAULT_REQUIRED_FIELDS,
): UnresolvedQuestion[] {
  return requiredFields
    .filter((field) => {
      const value = terms[field];
      if (typeof value === "undefined") return true;
      if (typeof value === "string") return value.trim().length === 0;
      return !Number.isFinite(value) || value <= 0;
    })
    .map((field) => ({
      id: `${field}-missing`,
      field,
      question: questionText[field] ?? `Please confirm the ${field} field.`,
      required: true,
    }));
}

export function buildManualOfferReview(input: ManualOfferRequest, requesterId: string) {
  const normalizedTerms = normalizeOfferTerms(input.terms);
  const unresolved = deriveUnresolvedQuestions(normalizedTerms);
  const termHash = computeOfferHash(normalizedTerms);

  return {
    offerId: input.offerId,
    companyId: input.companyId,
    workerId: input.workerId,
    version: input.expectedVersion,
    requesterRole: input.requesterRole,
    requesterId,
    termHash,
    unresolved,
    snapshot: normalizedTerms,
    idempotencyKey: input.idempotencyKey,
  };
}

export function confirmAgreement(input: AgreementConfirmation, confirmedBy: string, currentHash: string, status: "awaiting_other_party" | "confirmed") {
  return {
    agreementId: input.agreementId,
    offerId: input.offerId,
    version: input.expectedVersion,
    confirmedBy,
    confirmationRole: input.confirmationRole,
    currentHash,
    status,
  };
}

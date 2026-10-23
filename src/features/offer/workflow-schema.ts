import { z } from "zod";

const hash = z.string().regex(/^[0-9a-f]{64}$/);
const ids = z.array(z.uuid()).max(100).refine(values => new Set(values).size === values.length);
const state = z.enum(["draft", "proposed", "confirmed", "declined", "superseded"]);
const base = { agreementId: z.uuid(), idempotencyKey: z.uuid() };
const source = { offerId: z.uuid(), offerVersion: z.number().int().positive(), expectedSourceHash: hash };
const expected = { expectedVersion: z.number().int().positive(), expectedHash: hash, expectedState: state };
const acknowledgement = { acknowledgedItemIds: ids, expectedItemSetHash: hash };
export const workflowCommandSchema = z.discriminatedUnion("operation", [
  z.strictObject({ ...base, ...source, operation: z.literal("create"), representativeId: z.uuid() }),
  z.strictObject({ ...base, ...source, ...expected, operation: z.literal("amend") }),
  z.strictObject({ ...base, ...expected, operation: z.literal("propose"), sharedQuestionIds: ids }),
  z.strictObject({ ...base, ...expected, ...acknowledgement, operation: z.literal("acknowledge") }),
  z.strictObject({ ...base, ...expected, ...acknowledgement, operation: z.literal("decide"), decision: z.enum(["confirm", "decline"]) }),
]);
export const workflowReadRequestSchema = z.strictObject({ agreementId: z.uuid() });
const time = z.iso.datetime({ offset: true });
const content = z.strictObject({
  schemaVersion: z.literal("agreement-terms.v1"), workerId: z.uuid(), companyId: z.uuid(), representativeId: z.uuid(), authorityDecisionId: z.uuid(),
  source: z.strictObject({ offerId: z.uuid(), version: z.number().int().positive(), termHash: hash, snapshot: z.record(z.string(),z.union([z.string(),z.number()])) }),
  terms: z.record(z.string(),z.union([z.string(),z.number(),z.null()])),
  unresolved: z.array(z.strictObject({ itemId:z.uuid(), fieldId:z.string(), issueCode:z.literal("not_stated"), sourceQuestionId:z.uuid().nullable(), explanation:z.string() })),
  sharedQuestions:z.array(z.strictObject({id:z.uuid(),field:z.string(),question:z.string(),required:z.boolean()})),
  answers:z.array(z.strictObject({id:z.uuid(),questionId:z.uuid(),answer:z.string(),answeredBy:z.uuid(),answeredAt:time})),
});
export const workflowVersionSchema = z.strictObject({
  version:z.number().int().positive(),state,content,contentHash:hash,unresolvedIds:ids,itemSetHash:hash,createdAt:time,proposedAt:time.nullable(),
  status:z.enum(["ready_for_review","awaiting_answers","awaiting_acknowledgements","awaiting_confirmations","effective","declined","superseded","revision_conflict"]),
  acknowledgements:z.array(z.strictObject({actorId:z.uuid(),contentHash:hash,itemIds:ids,itemSetHash:hash,recordedAt:time})),
  decisions:z.array(z.strictObject({actorId:z.uuid(),decision:z.enum(["confirm","decline"]),contentHash:hash,recordedAt:time})),
});
export const workflowReadSchema = z.strictObject({
  agreementId:z.uuid(),workerId:z.uuid(),companyId:z.uuid(),representativeId:z.uuid(),currentVersion:z.number().int().positive(),effectiveVersion:z.number().int().positive().nullable(),versions:z.array(workflowVersionSchema),
});
export const workflowReceiptSchema = z.strictObject({ agreementId:z.uuid(),version:z.number().int().positive(),contentHash:hash,state,actorId:z.uuid(),operation:z.enum(["create","amend","propose","acknowledge","decide"]),recordedAt:time });
export type AgreementWorkflow = z.infer<typeof workflowReadSchema>;
export type AgreementVersion = z.infer<typeof workflowVersionSchema>;
export type WorkflowCommand = z.infer<typeof workflowCommandSchema>;

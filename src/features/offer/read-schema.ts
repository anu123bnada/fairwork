import { z } from "zod";

const role = z.enum(["EMPLOYER", "WORKER"]);
const term = z.union([z.string(), z.number().finite()]);
export const agreementReadRequestSchema = z.strictObject({ offerId: z.uuid() });
export const agreementReadSchema = z.strictObject({
  offer: z.strictObject({
    offerId: z.uuid(), companyId: z.uuid(), workerId: z.uuid(), representativeId: z.uuid().nullable(),
    requesterId: z.uuid(), requesterRole: role, version: z.number().int().positive(),
    termHash: z.string().regex(/^[a-f0-9]{64}$/), snapshot: z.record(z.string(), term),
    changes: z.array(z.strictObject({ field: z.string(), previous: term.nullable(), current: term.nullable() })),
    unresolved: z.array(z.strictObject({ id: z.uuid(), field: z.string(), question: z.string(), required: z.boolean() })),
  }),
  agreementId: z.uuid(),
  confirmation: z.strictObject({
    agreementId: z.uuid(), offerId: z.uuid(), version: z.number().int().positive(), confirmedBy: z.uuid(),
    confirmationRole: role, currentHash: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(["awaiting_other_party", "confirmed"]),
  }).nullable(),
  answers: z.array(z.strictObject({ questionId: z.uuid(), answer: z.string(), answeredBy: z.uuid() })),
  canConfirm: z.boolean(),
});
export type AgreementRead = z.infer<typeof agreementReadSchema>;

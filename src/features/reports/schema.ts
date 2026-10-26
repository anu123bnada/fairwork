import { z } from "zod";

// User reports about suspicious recruiters, listings and organizations (modules 13 and 17). A report is a private message to reviewers: it is never
// shown to the person it names, never published, and never an accusation by ORYQEN.
export const reportCategories = ["fee_request", "impersonation", "fake_listing", "harassment", "data_misuse", "other"] as const;
export const reportSubjectKinds = ["recruiter_check", "listing", "organization", "other"] as const;
export const reportStatuses = ["received", "reviewing", "needs_information", "closed_actioned", "closed_no_action", "withdrawn"] as const;

export const reportInput = z.strictObject({
  reportId: z.uuid(), subjectKind: z.enum(reportSubjectKinds), subjectRef: z.uuid().nullable(),
  subjectLabel: z.string().trim().min(1).max(120), category: z.enum(reportCategories), details: z.string().trim().min(10).max(1000), idempotencyKey: z.uuid(),
});
export const reportEvent = z.strictObject({ event: z.enum(reportStatuses), note: z.string().nullable(), at: z.string() });
export const reportRow = z.strictObject({
  reportId: z.uuid(), subjectKind: z.enum(reportSubjectKinds), subjectLabel: z.string(), category: z.enum(reportCategories), details: z.string(), createdAt: z.string(),
  status: z.enum(reportStatuses), revision: z.number().int().nonnegative(), events: z.array(reportEvent),
});
export const reportList = z.strictObject({ items: z.array(reportRow).max(20) });
export const queueRow = z.strictObject({
  reportId: z.uuid(), subjectKind: z.enum(reportSubjectKinds), subjectLabel: z.string(), category: z.enum(reportCategories), details: z.string(), createdAt: z.string(),
  status: z.enum(reportStatuses), revision: z.number().int().nonnegative(), own: z.boolean(),
});
export const reportQueue = z.strictObject({ items: z.array(queueRow).max(20) });
export const reviewInput = z.strictObject({
  reportId: z.uuid(), expectedRevision: z.number().int().nonnegative(), event: z.enum(["reviewing", "needs_information", "closed_actioned", "closed_no_action"]),
  note: z.string().trim().max(500).nullable().optional(),
}).refine(value => value.event === "reviewing" || Boolean(value.note?.trim()), { message: "A note is required." });

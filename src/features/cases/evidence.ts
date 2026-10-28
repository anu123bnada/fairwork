import { z } from "zod";

// Evidence references on a dispute (module 9): a snapshot of the opener's own Evidence Vault document (title, type, name, size, SHA-256). It does not give anyone the file.
export const caseEvidenceAttachInput = z.strictObject({ caseId: z.uuid(), documentId: z.uuid() });
export const caseEvidenceAttached = z.strictObject({ caseId: z.uuid(), documentId: z.uuid(), replayed: z.boolean() });
export const caseEvidenceList = z.strictObject({
  caseId: z.uuid(),
  items: z.array(z.strictObject({ documentId: z.uuid(), title: z.string(), category: z.string(), fileName: z.string(), mediaType: z.string(), byteSize: z.number().int(), sha256: z.string(), attachedAt: z.string(), attachedBy: z.uuid() })).max(10),
});
export type CaseEvidenceItem = z.infer<typeof caseEvidenceList>["items"][number];

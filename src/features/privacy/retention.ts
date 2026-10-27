import type { MessageKey } from "@/i18n";

// How long each class of data is kept (module 12). Every line states behaviour that already exists: who may erase it and what is automatic.
// "records" is deliberately permanent and append-only; the privacy-request workflow, reviewed by a privacy operator, is the only erasure path for it.
export type RetentionWho = "owner" | "automatic" | "revoke" | "request";
export const retentionClasses: readonly { id: string; key: MessageKey; who: RetentionWho }[] = [
  { id: "vault", key: "rt.vault", who: "owner" },
  { id: "notes", key: "rt.notes", who: "owner" },
  { id: "guidance", key: "rt.guidance", who: "owner" },
  { id: "recruiter", key: "rt.recruiter", who: "automatic" },
  { id: "shares", key: "rt.shares", who: "revoke" },
  { id: "records", key: "rt.records", who: "request" },
];

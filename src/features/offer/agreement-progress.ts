import type { AgreementVersion } from "./workflow-schema";

export const progressSteps = ["prepared", "shared", "acknowledged", "confirmed"] as const;
export type ProgressStep = (typeof progressSteps)[number];
export type ProgressState = { kind: "steps"; reached: number; done: boolean } | { kind: "stopped"; reason: "declined" | "superseded" | "revision_conflict" };

// Where a version stands, read straight from its status. "reached" is the index of the step now in progress;
// when done, every step is complete. Declined, superseded and conflicted versions are not on the path at all.
export function agreementProgress(status: AgreementVersion["status"]): ProgressState {
  switch (status) {
    case "ready_for_review": case "awaiting_answers": return { kind: "steps", reached: 0, done: false };
    case "awaiting_acknowledgements": return { kind: "steps", reached: 1, done: false };
    case "awaiting_confirmations": return { kind: "steps", reached: 2, done: false };
    case "effective": return { kind: "steps", reached: 3, done: true };
    default: return { kind: "stopped", reason: status };
  }
}

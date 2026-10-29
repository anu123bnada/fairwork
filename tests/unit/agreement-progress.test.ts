import { describe, expect, it } from "vitest";
import { agreementProgress } from "@/features/offer/agreement-progress";

describe("agreement progress", () => {
  it("maps each status to one place on the path", () => {
    expect(agreementProgress("awaiting_answers")).toEqual({ kind: "steps", reached: 0, done: false });
    expect(agreementProgress("awaiting_acknowledgements")).toEqual({ kind: "steps", reached: 1, done: false });
    expect(agreementProgress("awaiting_confirmations")).toEqual({ kind: "steps", reached: 2, done: false });
    expect(agreementProgress("effective")).toEqual({ kind: "steps", reached: 3, done: true });
  });
  it("never shows a declined, replaced or conflicted version as progressing", () => {
    for (const status of ["declined", "superseded", "revision_conflict"] as const) expect(agreementProgress(status)).toEqual({ kind: "stopped", reason: status });
  });
});

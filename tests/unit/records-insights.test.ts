import { describe, expect, it } from "vitest";
import { computeInsights } from "@/features/records/insights";
import type { RecordSummary } from "@/features/records/schema";

let n = 0;
const app = (title: string, status: string, summary: Partial<RecordSummary["summary"]> = {}): RecordSummary => ({
  id: `40000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, kind: "application", title, status, revision: 1, updatedAt: "2026-11-01T00:00:00Z",
  summary: { organization: null, nextStepAt: null, appliedOn: null, dueOn: null, taskCount: 0, tasksDone: 0, eventCount: 0, milestoneCount: 0, milestonesDone: 0, category: null, careerId: null, role: null, ...summary },
});
const today = "2026-11-10";

describe("application insights", () => {
  it("counts outcomes from the person's own list only", () => {
    const result = computeInsights([app("A", "saved"), app("B", "applied"), app("C", "interviewing"), app("D", "offered"), app("E", "rejected"), app("F", "accepted")], today);
    expect(result).toMatchObject({ total: 6, applied: 5, reachedInterview: 3, offers: 2, rejected: 1 });
    expect(result.counts).toMatchObject({ saved: 1, applied: 1, interviewing: 1, offered: 1, rejected: 1, accepted: 1 });
  });
  it("suggests a follow-up for an overdue next step and for an old application with no reply, longest first", () => {
    const result = computeInsights([
      app("Overdue", "interviewing", { nextStepAt: "2026-11-05T09:00" }),
      app("Quiet", "applied", { appliedOn: "2026-10-20" }),
      app("Recent", "applied", { appliedOn: "2026-11-08" }),
      app("Has events", "applied", { appliedOn: "2026-10-01", eventCount: 1 }),
      app("Future step", "applied", { appliedOn: "2026-10-01", nextStepAt: "2026-11-20" }),
      app("Closed", "rejected", { nextStepAt: "2026-10-01" }),
      app("Saved", "saved", { appliedOn: "2026-10-01" }),
    ], today);
    expect(result.followUps).toEqual([
      expect.objectContaining({ title: "Quiet", reason: "no_reply", days: 21 }),
      expect.objectContaining({ title: "Overdue", reason: "overdue_next_step", days: 5 }),
    ]);
  });
  it("is empty and safe for no applications or bad dates", () => {
    expect(computeInsights([], today)).toMatchObject({ total: 0, applied: 0, followUps: [] });
    expect(computeInsights([app("Odd", "applied", { appliedOn: "soon" })], today).followUps).toEqual([]);
  });
});

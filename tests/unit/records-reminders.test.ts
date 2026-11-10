import { describe, expect, it } from "vitest";
import { scheduleReminders } from "@/features/records/reminders";
import type { RecordSummary } from "@/features/records/schema";

let n = 0;
const app = (title: string, status: string, summary: Partial<RecordSummary["summary"]> = {}): RecordSummary => ({
  id: `40000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, kind: "application", title, status, revision: 1, updatedAt: "2026-11-01T00:00:00Z",
  summary: { organization: null, nextStepAt: null, appliedOn: null, dueOn: null, taskCount: 0, tasksDone: 0, eventCount: 0, milestoneCount: 0, milestonesDone: 0, category: null, careerId: null, role: null, ...summary },
});
const today = "2026-11-10";

describe("reminders from the tracker", () => {
  it("lists today and the next three days, then overdue and no-reply follow-ups, in a stable order", () => {
    const list = scheduleReminders([
      app("Later", "interviewing", { nextStepAt: "2026-11-20T09:00" }),
      app("In three days", "applied", { nextStepAt: "2026-11-13T09:00", appliedOn: "2026-11-01", eventCount: 1 }),
      app("Today", "interviewing", { nextStepAt: "2026-11-10T14:00" }),
      app("Tomorrow", "offered", { nextStepAt: "2026-11-11" }),
      app("Overdue", "interviewing", { nextStepAt: "2026-11-05T09:00" }),
      app("Quiet", "applied", { appliedOn: "2026-10-20" }),
    ], today);
    expect(list.map(item => `${item.kind}:${item.title}`)).toEqual(["overdue_next_step:Overdue", "today:Today", "soon:Tomorrow", "soon:In three days", "no_reply:Quiet"]);
    expect(list.find(item => item.title === "Tomorrow")).toMatchObject({ days: 1, at: "2026-11-11" });
  });
  it("ignores closed and saved applications and bad dates, and is empty for no records", () => {
    expect(scheduleReminders([app("Rejected", "rejected", { nextStepAt: "2026-11-10" }), app("Saved", "saved", { nextStepAt: "2026-11-10" }), app("Odd", "applied", { nextStepAt: "soon" })], today)).toEqual([]);
    expect(scheduleReminders([], today)).toEqual([]);
  });
});

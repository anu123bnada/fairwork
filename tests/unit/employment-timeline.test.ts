import { describe, expect, it } from "vitest";
import { buildTimeline } from "@/features/work/timeline";
import { expiringShares } from "@/components/fairwork/reminders";
import { translate } from "@/i18n";

const job = (id: string, startDate: string, endDate: string | null, current = false) => ({ id, content: { employer: `Employer ${id}`, role: "Technician", startDate, endDate, current } });
const work = (workId: string, periodStart: string, periodEnd: string, state = "verified") => ({ workId, state, hours: "40", periodStart, periodEnd });

describe("employment timeline", () => {
  it("merges self-reported jobs and work records, newest start first, keeping each source's kind", () => {
    const timeline = buildTimeline([job("a", "2022-03", "2023-01"), job("b", "2024-06", null, true)], [work("w1", "2023-05-01", "2023-05-31"), work("w2", "2024-07-01", "2024-07-31", "submitted")]);
    expect(timeline.map(entry => entry.id)).toEqual(["w2", "b", "w1", "a"]);
    expect(timeline.map(entry => entry.kind)).toEqual(["work_record", "self_reported", "work_record", "self_reported"]);
    expect(timeline.find(entry => entry.id === "w2")).toMatchObject({ state: "submitted" });
  });
  it("shows a current job with no end, never marks anything verified itself, and is stable on ties", () => {
    const timeline = buildTimeline([job("z", "2024-01", null, true), job("y", "2024-01", "2024-12")], []);
    expect(timeline[0]).toMatchObject({ id: "z", end: null });
    expect(timeline.every(entry => entry.kind === "self_reported")).toBe(true);
    expect(buildTimeline([job("b", "2024-01", "2024-02"), job("a", "2024-01", "2024-02")], []).map(entry => entry.id)).toEqual(["a", "b"]);
  });
  it("handles nothing and does not mutate its input", () => {
    expect(buildTimeline([], [])).toEqual([]);
    const history = [job("a", "2020-01", "2020-02"), job("b", "2021-01", "2021-02")];
    buildTimeline(history, []);
    expect(history.map(item => item.id)).toEqual(["a", "b"]);
  });
  it("has wording in every language for every work state", () => {
    for (const locale of ["en", "si", "ta", "de"] as const)
      for (const state of ["draft", "submitted", "verified", "disputed", "rejected", "superseded", "withdrawn", "invalidated"]) expect(translate(locale, `tl.state.${state}` as never)).not.toBe(`tl.state.${state}`);
  });
});

describe("Passport link expiry reminders", () => {
  const NOW = Date.parse("2026-10-27T12:00:00Z");
  const at = (days: number) => new Date(NOW + days * 86_400_000).toISOString();
  const grant = (id: string, over: Record<string, unknown> = {}) => ({ grantId: id, owner: true, active: true, revoked: false, expiresAt: at(5), ...over });
  it("lists only the person's own active, unrevoked links ending within 14 days, soonest first", () => {
    const result = expiringShares([grant("later", { expiresAt: at(10) }), grant("soon", { expiresAt: at(2) }), grant("far", { expiresAt: at(30) }), grant("theirs", { owner: false }), grant("off", { active: false }), grant("revoked", { revoked: true }), grant("gone", { expiresAt: at(-1) })], NOW);
    expect(result.map(entry => entry.grantId)).toEqual(["soon", "later"]);
    expect(result.map(entry => entry.daysLeft)).toEqual([2, 10]);
  });
});

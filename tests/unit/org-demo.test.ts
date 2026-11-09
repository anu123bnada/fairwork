import { describe, expect, it } from "vitest";
import { VISITOR_ID, applicantsOf, countsOf, initialOrgDemo, parseOrgDemo, sampleApplicants } from "@/features/employers/org-demo";

describe("organization sandbox state (DEMO)", () => {
  it("starts with only fictional, labelled applicants, all submitted, and no visitor", () => {
    expect(sampleApplicants.every(item => item.name.includes("(SAMPLE)"))).toBe(true);
    expect(countsOf(initialOrgDemo)).toEqual({ submitted: 4, reviewing: 0, shortlisted: 0, declined: 0 });
    expect(applicantsOf(initialOrgDemo).some(item => item.id === VISITOR_ID)).toBe(false);
  });
  it("adds the visitor first when they apply and counts statuses", () => {
    const state = { ...initialOrgDemo, visitorApplied: true, visitorMessage: "Hello", statuses: { ...initialOrgDemo.statuses, [VISITOR_ID]: "shortlisted" as const, a1: "declined" as const } };
    const list = applicantsOf(state);
    expect(list[0]).toMatchObject({ id: VISITOR_ID, status: "shortlisted", message: "Hello" });
    expect(countsOf(state)).toEqual({ submitted: 3, reviewing: 0, shortlisted: 1, declined: 1 });
  });
  it("ignores anything unexpected read from the device", () => {
    expect(parseOrgDemo(null)).toEqual(initialOrgDemo);
    expect(parseOrgDemo("x")).toEqual(initialOrgDemo);
    const parsed = parseOrgDemo({ statuses: { a1: "hacked", zzz: "shortlisted", a2: "reviewing" }, visitorApplied: "yes", visitorMessage: "x".repeat(900) });
    expect(parsed.statuses.a1).toBe("submitted");
    expect(parsed.statuses.a2).toBe("reviewing");
    expect("zzz" in parsed.statuses).toBe(false);
    expect(parsed.visitorApplied).toBe(false);
    expect(parsed.visitorMessage).toHaveLength(300);
  });
});

import { describe, expect, it } from "vitest";
import { allSampleSkills, computeGap, exploreCareers } from "@/features/careers/gap";
import { sampleCareerById, sampleCareers } from "@/features/careers/sample-data";

describe("sample career framework and skill gap", () => {
  it("is internally consistent: unique ids, every role has a step for each skill, next roles exist", () => {
    expect(new Set(sampleCareers.map(career => career.id)).size).toBe(sampleCareers.length);
    for (const career of sampleCareers) {
      expect(career.skills.some(skill => skill.weight === "core"), career.id).toBe(true);
      for (const skill of career.skills) expect(career.steps[skill.name], `${career.id}:${skill.name}`).toBeTruthy();
      for (const next of career.nextRoles) expect(sampleCareerById(next), `${career.id}->${next}`).not.toBeNull();
    }
  });
  it("computes coverage from core skills only, ignoring case and spacing", () => {
    const gap = computeGap("welder", ["mig  welding", "SAFE WORK", "Metal cutting"])!;
    expect(gap.have).toEqual(["MIG welding", "Safe work", "Metal cutting"]);
    expect(gap.missingCore).toEqual(["Reading drawings"]);
    expect(gap.missingHelpful).toEqual(["Arc welding"]);
    expect(gap.coreCoveragePercent).toBe(67);
    expect(gap.roadmap.map(step => step.skill)).toEqual(["Reading drawings", "Arc welding"]);
    expect(gap.nextRoles.map(role => role.id)).toEqual(["site-supervisor"]);
  });
  it("reports 0% for no skills and 100% with an empty roadmap when everything is covered, and null for an unknown role", () => {
    expect(computeGap("driver", [])!.coreCoveragePercent).toBe(0);
    const full = computeGap("driver", sampleCareerById("driver")!.skills.map(skill => skill.name))!;
    expect(full.coreCoveragePercent).toBe(100);
    expect(full.roadmap).toEqual([]);
    expect(computeGap("astronaut", ["x"])).toBeNull();
  });
  it("ranks roles by core coverage and lists every sample skill once", () => {
    const ranked = exploreCareers(["MIG welding", "Reading drawings", "Safe work"]);
    expect(ranked[0]!.career.id).toBe("welder");
    expect(ranked[0]!.coreCoveragePercent).toBe(100);
    expect(new Set(allSampleSkills()).size).toBe(allSampleSkills().length);
  });
});

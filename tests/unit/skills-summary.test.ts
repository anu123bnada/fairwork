import { expect, it } from "vitest";
import { summarizeSkills } from "@/features/work/skills";
import type { EmploymentPage } from "@/features/work/employment-schema";
const entry = (role: string, employer: string, startDate: string, endDate: string | null, skills: string[]): EmploymentPage["items"][number] => ({
  id: crypto.randomUUID(), revision: 1, savedAt: "2026-10-26T00:00:00Z", verification: "self_reported",
  content: { role, employer, startDate, endDate, current: endDate === null, skills, achievements: "" },
});
const now = new Date("2026-10-26T00:00:00Z");
it("sums inclusive months per skill, merges spellings and ranks by experience", () => {
  const result = summarizeSkills([
    entry("Welder", "A", "2020-01", "2020-12", ["Welding", "safety"]),
    entry("Technician", "B", "2025-11", null, ["welding ", "Blueprint reading"]),
  ], now);
  expect(result.map(r => [r.skill, r.months])).toEqual([["Welding", 12 + 12], ["Blueprint reading", 12], ["safety", 12]].sort((a, b) => (b[1] as number) - (a[1] as number) || String(a[0]).localeCompare(String(b[0]))));
  expect(result[0]!.roles).toEqual([{ role: "Welder", employer: "A" }, { role: "Technician", employer: "B" }]);
});
it("counts a duplicated skill once per entry and handles single-month and empty input", () => {
  expect(summarizeSkills([entry("X", "Y", "2024-05", "2024-05", ["Go", "go", " GO "])], now)).toEqual([{ skill: "Go", months: 1, roles: [{ role: "X", employer: "Y" }] }]);
  expect(summarizeSkills([], now)).toEqual([]);
  expect(summarizeSkills([entry("X", "Y", "2024-05", "2024-06", [])], now)).toEqual([]);
});

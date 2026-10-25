import type { EmploymentPage } from "./employment-schema";

export type SkillSummary = { skill: string; months: number; roles: { role: string; employer: string }[] };

const monthIndex = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));

// Aggregates the user's own, self-reported entries. Months are the sum of entry spans
// (inclusive of both end months); overlapping entries are counted separately because this is
// a summary of what the user wrote, not a verified measure of experience.
export function summarizeSkills(items: EmploymentPage["items"], now: Date): SkillSummary[] {
  const today = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  const map = new Map<string, SkillSummary>();
  for (const { content } of items) {
    const end = content.current ? today : monthIndex(content.endDate ?? content.startDate);
    const months = Math.max(1, end - monthIndex(content.startDate) + 1);
    const seen = new Set<string>();
    for (const raw of content.skills) {
      const key = raw.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = map.get(key) ?? { skill: raw.trim(), months: 0, roles: [] };
      entry.months += months;
      entry.roles.push({ role: content.role, employer: content.employer });
      map.set(key, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.months - a.months || a.skill.localeCompare(b.skill));
}

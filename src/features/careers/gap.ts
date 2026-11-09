import { sampleCareerById, sampleCareers, type SampleCareer } from "./sample-data";

// Skill gap against the SAMPLE framework. Pure comparison of the person's own skill list with the sample skills: no scoring of the person, no real-world claims.
const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
export type Gap = {
  career: SampleCareer;
  have: string[];
  missingCore: string[];
  missingHelpful: string[];
  coreCoveragePercent: number;
  roadmap: { skill: string; weight: "core" | "helpful"; step: string }[];
  nextRoles: SampleCareer[];
};

export function computeGap(careerId: string, skills: string[]): Gap | null {
  const career = sampleCareerById(careerId);
  if (!career) return null;
  const mine = new Set(skills.map(norm).filter(Boolean));
  const has = (name: string) => mine.has(norm(name));
  const coreSkills = career.skills.filter(skill => skill.weight === "core");
  const missing = career.skills.filter(skill => !has(skill.name));
  return {
    career,
    have: career.skills.filter(skill => has(skill.name)).map(skill => skill.name),
    missingCore: missing.filter(skill => skill.weight === "core").map(skill => skill.name),
    missingHelpful: missing.filter(skill => skill.weight === "helpful").map(skill => skill.name),
    coreCoveragePercent: coreSkills.length === 0 ? 0 : Math.round((100 * coreSkills.filter(skill => has(skill.name)).length) / coreSkills.length),
    roadmap: [...missing].sort((a, b) => (a.weight === b.weight ? 0 : a.weight === "core" ? -1 : 1)).map(skill => ({ skill: skill.name, weight: skill.weight, step: career.steps[skill.name] ?? "" })),
    nextRoles: career.nextRoles.map(sampleCareerById).filter((role): role is SampleCareer => role !== null),
  };
}

// Which sample careers a skill list already overlaps most, so a person who is unsure can start somewhere. Ranked by core coverage, then by number of skills shared.
export function exploreCareers(skills: string[]): { career: SampleCareer; coreCoveragePercent: number; shared: number }[] {
  return sampleCareers
    .map(career => { const gap = computeGap(career.id, skills)!; return { career, coreCoveragePercent: gap.coreCoveragePercent, shared: gap.have.length }; })
    .sort((a, b) => b.coreCoveragePercent - a.coreCoveragePercent || b.shared - a.shared || a.career.title.localeCompare(b.career.title));
}

export const allSampleSkills = (): string[] => [...new Set(sampleCareers.flatMap(career => career.skills.map(skill => skill.name)))].sort((a, b) => a.localeCompare(b));

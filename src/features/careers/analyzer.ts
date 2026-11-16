import type { CareerProfileContent } from "@/features/records/schema";
import { coursesForSkill, courseById, type Course } from "./courses";
import { referenceCareerById, referenceCareerByTitle, type Importance, type RefCareer } from "./reference";

// Career gap analysis. Pure rules over (a) what the person typed into their profile and (b) the ORYQEN reference framework. There is NO AI model here and NO score:
// the result is a list that says, for each requirement, what the person told us and how strong their own evidence is. Nothing is ever marked verified, because nothing
// in ORYQEN independently verifies a skill or qualification, and a finished course never turns into a qualification by itself.
const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

export type Standing =
  | "missing" // not in the profile and no finished course for it: a confirmed gap in what the person has told us
  | "learning" // a course for it is started but none is finished
  | "course_completed" // the person marked a course for it as completed; not shown in practice, not verified
  | "self_reported" // typed by the person, no proof described
  | "demonstrated" // the person describes using it in real work or a project; still unverified
  | "evidence_attached"; // the person says they hold proof (a link or document) and described it; ORYQEN has not checked it

export const STANDING_LABEL: Record<Standing, string> = {
  missing: "Gap: not in your profile",
  learning: "Gap: learning started",
  course_completed: "Course finished, not yet shown in practice",
  self_reported: "Self-reported, no proof",
  demonstrated: "Demonstrated by you, unverified",
  evidence_attached: "Proof described by you, not checked by ORYQEN",
};
const isGap = (standing: Standing) => standing === "missing" || standing === "learning";

export type Resource = { course: Course; status: "not_started" | "started" | "completed"; evidenceLink: string; fitsFormat: boolean };
export type SkillItem = {
  name: string; importance: Importance | "user_defined"; why: string; standing: Standing; resources: Resource[];
  /** True when the framework has no verified free course for this skill; the screen says so instead of filling the list. */
  noVerifiedCourse: boolean;
};
export type QualificationItem = { name: string; kind: string; importance: Importance; regulated: boolean; why: string; standing: "missing" | "self_reported" | "evidence_attached" };
export type Analysis = {
  goalTitle: string;
  framework: "reference" | "custom" | "none";
  career: RefCareer | null;
  skills: SkillItem[];
  qualifications: QualificationItem[];
  /** Remaining gaps in the order they should be tackled: essential before helpful, then the framework order. */
  roadmap: SkillItem[];
  counts: { essentialTotal: number; essentialAddressed: number; essentialGaps: number; helpfulGaps: number; qualificationGaps: number; regulatedQualificationGaps: number };
  languageNote: string | null;
};

function resourcesFor(skill: string, profile: CareerProfileContent): Resource[] {
  const progress = new Map(profile.progress.map(entry => [entry.resourceId, entry]));
  const preferred = profile.learning.format;
  return coursesForSkill(skill)
    .map(course => { const entry = progress.get(course.id); return { course, status: entry?.status ?? "not_started" as const, evidenceLink: entry?.evidenceLink ?? "", fitsFormat: preferred === "any" || course.format === preferred }; })
    .sort((a, b) => Number(b.fitsFormat) - Number(a.fitsFormat));
}

function standingFor(name: string, profile: CareerProfileContent, resources: Resource[]): Standing {
  const entry = profile.skills.find(skill => norm(skill.name) === norm(name));
  if (entry) return entry.evidence;
  if (resources.some(resource => resource.status === "completed")) return "course_completed";
  if (resources.some(resource => resource.status === "started")) return "learning";
  return "missing";
}

export function analyzeCareer(profile: CareerProfileContent): Analysis {
  const goal = profile.primaryGoal;
  const career = (goal.careerId ? referenceCareerById(goal.careerId) : null) ?? referenceCareerByTitle(goal.title);
  const requirements: { name: string; importance: Importance | "user_defined"; why: string }[] = career
    ? career.skills.map(skill => ({ name: skill.name, importance: skill.importance, why: skill.why }))
    : profile.customRequirements.map(name => ({ name, importance: "user_defined" as const, why: "You listed this as a requirement for your goal. ORYQEN has no reference framework for this goal, so it has not checked that it is what employers ask for." }));
  const skills: SkillItem[] = requirements.map(requirement => {
    const resources = resourcesFor(requirement.name, profile);
    return { ...requirement, standing: standingFor(requirement.name, profile, resources), resources, noVerifiedCourse: resources.length === 0 };
  });
  const qualifications: QualificationItem[] = (career?.qualifications ?? []).map(qualification => {
    const entry = profile.qualifications.find(item => norm(item.name) === norm(qualification.name));
    // A qualification can only be self-reported or described with proof; finishing a course never satisfies it, least of all a regulated licence.
    return { name: qualification.name, kind: qualification.kind, importance: qualification.importance, regulated: qualification.regulated, why: qualification.why, standing: !entry ? "missing" : entry.evidence === "evidence_attached" ? "evidence_attached" : "self_reported" };
  });
  const rank = (item: SkillItem) => item.importance === "essential" ? 0 : item.importance === "user_defined" ? 1 : 2;
  const roadmap = skills.filter(skill => isGap(skill.standing)).sort((a, b) => rank(a) - rank(b));
  const essential = skills.filter(skill => skill.importance === "essential");
  const language = profile.learning.language.trim();
  return {
    goalTitle: goal.title, framework: career ? "reference" : profile.customRequirements.length > 0 ? "custom" : "none", career, skills, qualifications, roadmap,
    counts: {
      essentialTotal: essential.length, essentialAddressed: essential.filter(skill => !isGap(skill.standing)).length, essentialGaps: essential.filter(skill => isGap(skill.standing)).length,
      helpfulGaps: skills.filter(skill => skill.importance === "helpful" && isGap(skill.standing)).length,
      qualificationGaps: qualifications.filter(item => item.standing === "missing").length, regulatedQualificationGaps: qualifications.filter(item => item.standing === "missing" && item.regulated).length,
    },
    languageNote: language && norm(language) !== "english" ? `You prefer ${language}. Every resource in the verified catalog is in English; no verified ${language} resource has been added yet.` : null,
  };
}

/** The roadmap plus the learning progress in one view: how many catalog resources were started and finished, across everything the person marked. */
export function progressSummary(profile: CareerProfileContent) {
  const known = profile.progress.filter(entry => courseById(entry.resourceId));
  return { started: known.filter(entry => entry.status === "started").length, completed: known.filter(entry => entry.status === "completed").length };
}

/** Set a resource to started or completed (or back to not started). Returns a new profile; pure so it can be tested without a database. */
export function setProgress(profile: CareerProfileContent, resourceId: string, status: "not_started" | "started" | "completed", today: string, evidenceLink = ""): CareerProfileContent {
  if (!courseById(resourceId)) return profile;
  const rest = profile.progress.filter(entry => entry.resourceId !== resourceId);
  return { ...profile, progress: status === "not_started" ? rest : [...rest, { resourceId, status, updatedOn: today, evidenceLink }] };
}

export const NOT_A_QUALIFICATION = "Finishing a course does not by itself qualify anyone for a regulated profession or a job. Employers and licensing bodies decide what they accept.";

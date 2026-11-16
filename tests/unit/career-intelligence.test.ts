import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { analyzeCareer, progressSummary, setProgress } from "@/features/careers/analyzer";
import { courses, coursesForSkill } from "@/features/careers/courses";
import { referenceCareers } from "@/features/careers/reference";
import { matchListing, rankListings, setFeedback } from "@/features/opportunities/intelligence";
import { careerProfileContent, emptyCareerProfile, emptyFeedback, opportunityFeedbackContent, recordSaveInput, type CareerProfileContent } from "@/features/records/schema";
import type { Opportunity } from "@/features/opportunities/schema";

const profile = (over: Partial<CareerProfileContent> = {}): CareerProfileContent => ({ ...emptyCareerProfile, primaryGoal: { careerId: "junior-web-developer", title: "Junior web developer" }, ...over });
const skill = (name: string, evidence: "self_reported" | "demonstrated" | "evidence_attached" = "self_reported") => ({ id: randomUUID(), name, kind: "technical" as const, evidence, note: "" });
const listing = (title: string, description: string, over: Partial<Opportunity["fields"]> = {}) => ({
  id: randomUUID(), companyId: randomUUID(), companyName: "DEMO Co", version: 1, status: "published", choice: "none", canEdit: false, updatedAt: "2026-11-15T00:00:00Z", expiresAt: "2026-12-15T00:00:00Z",
  fields: { title, description, location: "Colombo", workMode: "onsite", salary: null, currency: "LKR", payPeriod: "month", ...over },
}) as unknown as Opportunity;

describe("verified course catalog", () => {
  it("has unique ids, https links on the providers' own domains, a verification date and never claims a certificate is free", () => {
    expect(new Set(courses.map(course => course.id)).size).toBe(courses.length);
    for (const course of courses) {
      expect(course.url, course.id).toMatch(/^https:\/\/[a-z0-9.-]+\//);
      expect(course.verifiedOn, course.id).toBe("2026-11-16");
      expect(course.free).toBe(true);
      expect(["none", "not_stated"]).toContain(course.certificate); // a free certificate is never asserted
      expect(course.skills.length, course.id).toBeGreaterThan(0);
    }
  });
  it("covers each web-developer skill except Testing, and says so rather than padding", () => {
    const web = referenceCareers.find(career => career.id === "junior-web-developer")!;
    const without = web.skills.filter(item => coursesForSkill(item.name).length === 0).map(item => item.name);
    expect(without).toEqual(["Testing"]);
  });
});

describe("career gap analysis", () => {
  it("reports every skill as a gap for an empty profile and calls nothing verified", () => {
    const result = analyzeCareer(profile());
    expect(result.framework).toBe("reference");
    expect(result.skills.every(item => item.standing === "missing")).toBe(true);
    expect(result.counts.essentialGaps).toBe(result.counts.essentialTotal);
    expect(JSON.stringify(result)).not.toMatch(/"verified"|independently verified"/);
  });
  it("keeps self-reported, demonstrated and evidence levels apart and never upgrades them", () => {
    const result = analyzeCareer(profile({ skills: [skill("HTML"), skill("css", "demonstrated"), skill("JavaScript", "evidence_attached")] }));
    const standing = Object.fromEntries(result.skills.map(item => [item.name, item.standing]));
    expect(standing).toMatchObject({ HTML: "self_reported", CSS: "demonstrated", JavaScript: "evidence_attached", "Version control": "missing" });
  });
  it("orders the roadmap essential first and recalculates the gaps after progress", () => {
    const base = profile();
    const before = analyzeCareer(base);
    expect(before.roadmap[0]!.importance).toBe("essential");
    const started = setProgress(base, "webdev-learn-html", "started", "2026-11-16");
    expect(analyzeCareer(started).skills.find(item => item.name === "HTML")!.standing).toBe("learning");
    const done = setProgress(started, "webdev-learn-html", "completed", "2026-11-16");
    const after = analyzeCareer(done);
    expect(after.skills.find(item => item.name === "HTML")!.standing).toBe("course_completed");
    expect(after.counts.essentialGaps).toBe(before.counts.essentialGaps - 1);
    expect(progressSummary(done)).toEqual({ started: 0, completed: 1 });
    expect(analyzeCareer(setProgress(done, "webdev-learn-html", "not_started", "2026-11-16")).skills.find(item => item.name === "HTML")!.standing).toBe("missing");
  });
  it("ignores progress for a resource that is not in the verified catalog", () => {
    const base = profile();
    expect(setProgress(base, "invented-course", "completed", "2026-11-16")).toBe(base);
  });
  it("never treats a finished course as a licence: a regulated qualification stays missing", () => {
    const result = analyzeCareer(profile({ primaryGoal: { careerId: "electrician", title: "Electrician" }, progress: [{ resourceId: "webdev-learn-html", status: "completed", updatedOn: "2026-11-16", evidenceLink: "" }] }));
    const licence = result.qualifications.find(item => item.regulated)!;
    expect(licence.standing).toBe("missing");
    expect(result.counts.regulatedQualificationGaps).toBe(1);
    expect(result.skills.every(item => item.noVerifiedCourse)).toBe(true); // no invented trade courses
  });
  it("uses the person's own requirements for a goal with no framework and labels them as such", () => {
    const result = analyzeCareer(profile({ primaryGoal: { careerId: "", title: "Marine biologist" }, customRequirements: ["Diving", "Statistics"] }));
    expect(result.framework).toBe("custom");
    expect(result.skills.every(item => item.importance === "user_defined")).toBe(true);
    expect(analyzeCareer(profile({ primaryGoal: { careerId: "", title: "Marine biologist" } })).framework).toBe("none");
  });
  it("notes when the preferred language is not covered", () => {
    expect(analyzeCareer(profile({ learning: { language: "Sinhala", format: "any", hoursPerWeek: 5 } })).languageNote).toMatch(/Sinhala/);
    expect(analyzeCareer(profile()).languageNote).toBeNull();
  });
});

describe("profile schema", () => {
  it("accepts an empty profile, refuses unknown keys and non-https evidence links", () => {
    expect(careerProfileContent.safeParse(emptyCareerProfile).success).toBe(true);
    expect(careerProfileContent.safeParse({ ...emptyCareerProfile, verified: true }).success).toBe(false);
    expect(careerProfileContent.safeParse({ ...emptyCareerProfile, progress: [{ resourceId: "x", status: "completed", updatedOn: "", evidenceLink: "javascript:alert(1)" }] }).success).toBe(false);
    expect(recordSaveInput.safeParse({ id: randomUUID(), kind: "career_profile", title: "My career profile", status: "active", content: emptyCareerProfile, expectedRevision: 0 }).success).toBe(true);
    expect(opportunityFeedbackContent.safeParse(emptyFeedback).success).toBe(true);
  });
});

describe("opportunity matching and feedback", () => {
  const me = profile({ skills: [skill("HTML"), skill("CSS")] });
  it("lists matching skills, missing requirements and why, without a score or a promise", () => {
    const result = matchListing(listing("Junior web developer", "We use HTML, CSS and JavaScript every day."), me, null);
    expect(result.matchingSkills.sort()).toEqual(["CSS", "HTML"]);
    expect(result.missingRequirements).toEqual(["JavaScript"]);
    expect(result.why).toMatch(/not a prediction/);
    expect(result.criteria.find(item => item.id === "skills")!.outcome).toBe("not_met");
  });
  it("says there is nothing to compare when no profile or preference exists", () => {
    const result = matchListing(listing("Cashier", "Serve customers."), null, null);
    expect(result.checked).toBe(0);
    expect(result.why).toMatch(/nothing to compare/);
  });
  it("flags a licence or degree mention when the profile lists no qualification", () => {
    expect(matchListing(listing("Driver", "A valid licence is required."), me, null).eligibilityConcerns).toHaveLength(1);
  });
  it("ranks by criteria met, removes disliked and hidden listings into a separate list and lets feedback be reset", () => {
    const good = listing("Junior web developer", "HTML and CSS");
    const bad = listing("Cashier", "Serve customers");
    const ranked = rankListings([bad, good], me, null, emptyFeedback);
    expect(ranked.shown[0]!.item.id).toBe(good.id);
    const disliked = setFeedback(emptyFeedback, good.id, "dislike", "2026-11-16T00:00:00Z");
    const after = rankListings([bad, good], me, null, disliked);
    expect(after.shown.map(row => row.item.id)).toEqual([bad.id]);
    expect(after.hidden.map(row => row.item.id)).toEqual([good.id]);
    expect(rankListings([bad, good], me, null, setFeedback(disliked, good.id, null, "")).hidden).toHaveLength(0);
    expect(setFeedback(setFeedback(emptyFeedback, good.id, "like", "a"), good.id, "applied", "b").entries).toHaveLength(1);
  });
});

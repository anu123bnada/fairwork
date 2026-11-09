import { describe, expect, it } from "vitest";
import { analyzeCv, cvText, jobTerms } from "@/features/cv/analyze";
import { matchListings } from "@/features/cv/match";
import { emptyCv, type CvContent } from "@/features/cv/schema";

const strong: CvContent = {
  ...emptyCv,
  basics: { fullName: "Nimal Perera", headline: "Welder", email: "nimal@example.test", phone: "0771234567", location: "Kandy", links: [{ label: "Portfolio", url: "https://example.test/nimal" }] },
  summary: "Reliable welder with three years of workshop experience in MIG and TIG welding, blueprint reading and safe work practice, looking for a fabrication role.",
  education: [{ school: "Technical College", qualification: "NVQ Level 3 Welding", start: "2020", end: "2022", notes: "" }],
  experience: [
    { employer: "Steel Works", role: "Welder", start: "2022", end: "2025", details: "Welded 40 frames a week using MIG and TIG and checked each against the blueprint." },
    { employer: "Fab Shop", role: "Assistant", start: "2021", end: "2022", details: "Cut and prepared 200 parts a month." },
  ],
  skills: ["MIG welding", "TIG welding", "Blueprint reading", "Safety", "Grinding", "Measuring", "Teamwork", "Forklift"],
  projects: [{ name: "Gate repair", description: "Rebuilt a steel gate for a school.", link: "" }],
  certifications: [{ name: "First aid", issuer: "Red Cross", year: "2023" }],
};

describe("CV analyzer", () => {
  it("scores a complete CV high, with every point explained by a section", () => {
    const result = analyzeCv(strong);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.sections.reduce((sum, section) => sum + section.max, 0)).toBe(95);
    expect(result.sections.every(section => section.points <= section.max)).toBe(true);
    expect(result.findings.filter(finding => finding.severity === "high")).toEqual([]);
  });

  it("scores an empty CV low and names what is missing, most serious first", () => {
    const result = analyzeCv(emptyCv);
    expect(result.score).toBeLessThan(15);
    const ids = result.findings.map(finding => finding.id);
    expect(ids).toEqual(expect.arrayContaining(["name-missing", "contact-missing", "experience-none", "summary-missing", "skills-few"]));
    const severities = result.findings.map(finding => finding.severity);
    expect(severities).toEqual([...severities].sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a] - ({ high: 0, medium: 1, low: 2 })[b]));
  });

  it("flags an invalid email, missing end dates, mixed date formats, duplicate skills and no numbers", () => {
    const flawed: CvContent = { ...strong, basics: { ...strong.basics, email: "not-an-email", phone: "" },
      experience: [{ employer: "A", role: "B", start: "Mar 2024", end: "", details: "Did things" }], education: [{ school: "S", qualification: "Q", start: "2020", end: "2022", notes: "" }], skills: ["Welding", "welding", "Grinding"] };
    const ids = analyzeCv(flawed).findings.map(finding => finding.id);
    expect(ids).toEqual(expect.arrayContaining(["contact-missing", "experience-0-end", "dates-mixed", "skills-duplicate", "no-numbers"]));
  });

  it("compares with a job description by terms only: matched, missing, coverage, and a finding when coverage is low", () => {
    const job = "We need a welder with MIG welding, forklift licence, stainless steel fabrication and CNC press brake experience. Fabrication of stainless frames, fabrication drawings.";
    const result = analyzeCv(strong, { jobDescription: job });
    expect(result.keywords.provided).toBe(true);
    expect(result.keywords.matched).toEqual(expect.arrayContaining(["welding"]));
    expect(result.keywords.missing).toEqual(expect.arrayContaining(["stainless", "cnc"]));
    expect(result.keywords.coverage).toBeGreaterThan(0);
    const weak = analyzeCv({ ...emptyCv, skills: ["Cooking"] }, { jobDescription: job });
    expect(weak.findings.map(finding => finding.id)).toContain("low-keyword-coverage");
    expect(analyzeCv(strong).keywords).toEqual({ provided: false, matched: [], missing: [], coverage: null });
  });

  it("ignores generic hiring words and numbers when extracting job terms", () => {
    const terms = jobTerms("We are looking for an experienced candidate with strong skills and 5 years of experience in plumbing and plumbing repairs.");
    expect(terms).toContain("plumbing");
    expect(terms).not.toContain("experience");
    expect(terms).not.toContain("candidate");
    expect(terms).not.toContain("5");
  });

  it("never throws and treats all text as plain text", () => {
    expect(() => analyzeCv({ ...strong, summary: "<script>alert(1)</script>".repeat(80) })).not.toThrow();
    expect(cvText(emptyCv).trim()).toBe("");
  });
});

describe("listing matches from skills", () => {
  const listings = [
    { id: "1", title: "Welder", description: "MIG welding of steel frames in a workshop.", location: "Kandy", companyName: "Steel Works" },
    { id: "2", title: "Cashier", description: "Handle payments and help customers with their questions.", location: "Colombo", companyName: null },
    { id: "3", title: "Fabricator", description: "TIG welding and blueprint reading, safety first.", location: "Galle", companyName: "Fab Shop" },
  ];
  it("ranks only listings that mention a skill, most matches first, and says which skill matched", () => {
    const result = matchListings(["MIG welding", "TIG welding", "Blueprint reading", "Safety"], listings);
    expect(result.map(item => item.listing.id)).toEqual(["3", "1"]);
    expect(result[0]!.matched).toEqual(["tig welding", "blueprint reading", "safety"]);
    expect(matchListings(["Cooking"], listings)).toEqual([]);
  });
  it("matches short skills as whole words only and never invents listings", () => {
    expect(matchListings(["it"], listings)).toEqual([]);
    expect(matchListings(["sql"], [{ id: "9", title: "Data clerk", description: "Basic SQL and spreadsheets.", location: "", companyName: null }]).map(item => item.listing.id)).toEqual(["9"]);
    expect(matchListings([], listings)).toEqual([]);
    expect(matchListings(["welding"], [])).toEqual([]);
  });
});

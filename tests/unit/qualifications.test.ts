import { describe, expect, it } from "vitest";
import { compareQualifications, parseRequirements } from "@/features/offer/qualifications";
import { parseCsv, readLinkedInExport } from "@/features/offer/linkedin-export";

const job = `Warehouse Supervisor
Requirements:
- 3+ years of experience in warehouse operations
- Forklift licence
- Diploma in logistics or equivalent
- Strong communication skills
- Knowledge of SAP is preferred
Benefits:
- Transport allowance`;

describe("qualification comparison", () => {
  it("reads requirements only from the requirements section and flags optional ones", () => {
    const requirements = parseRequirements(job);
    expect(requirements.map(item => item.kind)).toEqual(["experience", "skill", "education", "skill", "skill"]);
    expect(requirements.find(item => /SAP/.test(item.text))!.mandatory).toBe(false);
    expect(requirements.some(item => /Transport/.test(item.text))).toBe(false);
    expect(requirements[0]).toMatchObject({ years: 3 });
  });

  it("matches what the person wrote, quotes it back, and explains the gaps without claiming verification", () => {
    const profile = "I worked 5 years in warehouse operations at a distribution centre.\nI hold a valid forklift licence.\nSAP basics from a short course.";
    const result = compareQualifications(profile, job);
    const matched = result.matches.map(match => match.requirement.text);
    expect(matched).toEqual(expect.arrayContaining(["3+ years of experience in warehouse operations", "Forklift licence", "Knowledge of SAP is preferred"]));
    expect(result.matches.find(match => /Forklift/.test(match.requirement.text))!.evidence).toBe("I hold a valid forklift licence.");
    const gapTexts = result.gaps.map(gap => gap.requirement.text);
    expect(gapTexts).toEqual(expect.arrayContaining(["Diploma in logistics or equivalent", "Strong communication skills"]));
    expect(result.gaps.every(gap => gap.suggestion.length > 20 && gap.reason.length > 5)).toBe(true);
    expect(result.limitations).toMatch(/does not verify any qualification/);
  });

  it("compares years and education levels and says so when the profile is silent", () => {
    expect(compareQualifications("2 years of warehouse operations", job).gaps.some(gap => /3 years and you mention 2/.test(gap.reason))).toBe(true);
    expect(compareQualifications("I like football.", job).unclear.some(item => /how many years/.test(item.reason))).toBe(true);
    const degree = compareQualifications("BSc in logistics management", job);
    expect(degree.matches.some(match => /Diploma/.test(match.requirement.text))).toBe(true);
    expect(compareQualifications("O/L certificate", job).gaps.some(gap => /Diploma/.test(gap.requirement.text))).toBe(true);
  });

  it("invents nothing from an empty profile", () => {
    const result = compareQualifications("", job);
    expect(result.matches).toEqual([]);
    expect(result.gaps.length + result.unclear.length).toBe(parseRequirements(job).length);
    expect(result.profile).toMatchObject({ years: null, educationLevel: null, wordCount: 0 });
  });
});

describe("LinkedIn data export files", () => {
  const positions = 'Company Name,Title,Description,Location,Started On,Finished On\n"Acme, Ltd","Store Keeper","Stock control\nand ""receiving""",Colombo,Jan 2018,Dec 2020\nBeta Stores,Supervisor,,Kandy,Jun 2020,\n';
  const skills = "Name\nForklift operation\nInventory control\n";
  const education = "School Name,Start Date,End Date,Notes,Degree Name,Activities\nNIBM,2015,2017,,Diploma in Logistics,\n";
  it("parses quoted CSV fields including commas, doubled quotes and line breaks", () => {
    expect(parseCsv(positions)[1]).toEqual(["Acme, Ltd", "Store Keeper", 'Stock control\nand "receiving"', "Colombo", "Jan 2018", "Dec 2020"]);
  });
  it("turns positions, skills and education into editable profile text and counts overlapping jobs once", () => {
    const result = readLinkedInExport([{ name: "Positions.csv", text: positions }, { name: "Skills.csv", text: skills }, { name: "Education.csv", text: education }], new Date("2022-01-15T00:00:00Z"));
    expect(result.recognised.sort()).toEqual(["education", "positions", "skills"]);
    expect(result.text).toContain("Experience: Store Keeper at Acme, Ltd (Jan 2018 – Dec 2020)");
    expect(result.text).toContain("Skills: Forklift operation, Inventory control");
    expect(result.text).toContain("Education: Diploma in Logistics, NIBM");
    expect(result.years).toBe(4); // Jan 2018 to Jan 2022, the Jun 2020 job overlaps
    const compared = compareQualifications(result.text, "Requirements:\n- 3 years in stores\n- Forklift\n- Diploma in logistics", { years: result.years });
    expect(compared.gaps).toEqual([]);
  });
  it("ignores files it does not recognise and never invents text", () => {
    const result = readLinkedInExport([{ name: "Connections.csv", text: "First Name,Last Name,Email Address\nA,B,c@d.e\n" }, { name: "empty.csv", text: "" }]);
    expect(result).toMatchObject({ text: "", years: null, recognised: [] });
    expect(result.ignored).toEqual(["Connections.csv", "empty.csv"]);
  });
});

// Compares what a person says about themselves with what a job asks for. Everything here is the person's own, unverified statement matched
// against wording in the job text. It does not check certificates, employers or dates, and it never says a person is or is not qualified.
export type EducationLevel = 0.5 | 1 | 2 | 3 | 4 | 5;
export type Requirement = { id: string; text: string; kind: "skill" | "education" | "experience"; mandatory: boolean; years: number | null; level: EducationLevel | null; terms: string[] };
export type Match = { requirement: Requirement; evidence: string; matchedTerms: string[] };
export type Gap = { requirement: Requirement; reason: string; suggestion: string };
export type QualificationResult = { matches: Match[]; gaps: Gap[]; unclear: Array<{ requirement: Requirement; reason: string }>; profile: { years: number | null; educationLevel: EducationLevel | null; wordCount: number }; limitations: string };

const LIMITS = "Based only on the text you provided, matched by wording. It does not verify any qualification, employer or date, and a match on wording is not proof that you meet a requirement as the employer means it.";
const STOP = new Set(["and", "or", "the", "a", "an", "of", "in", "to", "with", "for", "on", "at", "as", "is", "are", "be", "have", "has", "must", "should", "will", "can", "ability", "able", "good", "strong", "excellent", "knowledge", "skills", "skill", "experience", "experienced", "proven", "working", "work", "understanding", "familiarity", "using", "use", "least", "minimum", "years", "year", "plus", "preferred", "required", "requirement", "requirements", "similar", "role", "relevant", "basic", "advanced", "years'", "demonstrated", "including", "etc", "we", "you", "your", "our", "their", "any", "all", "other", "related", "field"]);
const SYNONYMS: Record<string, string[]> = {
  javascript: ["js", "ecmascript"], typescript: ["ts"], excel: ["spreadsheet", "spreadsheets", "msexcel"], word: ["msword"], communication: ["communicating", "communicate"], customer: ["client", "clients", "customers"],
  accounting: ["bookkeeping", "accounts", "accountancy"], driving: ["driver", "licence", "license"], forklift: ["forklifts"], welding: ["welder", "welds"], sales: ["selling"], english: ["eng"], python: ["py"], sql: ["mysql", "postgres", "postgresql"],
};
const stem = (word: string) => word.toLowerCase().replace(/[^a-z0-9+#.]/g, "").replace(/(?:ing|ed|es|s)$/, m => (m === "s" && word.length > 3) || m !== "s" ? "" : m);
function canonical(word: string): string {
  const base = stem(word);
  for (const [head, list] of Object.entries(SYNONYMS)) if (head === base || list.some(item => stem(item) === base)) return stem(head);
  return base;
}
const significant = (text: string) => [...new Set(text.toLowerCase().split(/[^a-z0-9+#.]+/).filter(word => word.length >= 3 && !STOP.has(word)).map(canonical).filter(Boolean))];

const EDUCATION: Array<[RegExp, EducationLevel]> = [
  [/\b(?:ph\.?d|doctorate|doctoral)\b/i, 5], [/\b(?:master'?s?|msc|m\.sc|mba|postgraduate)\b/i, 4], [/\b(?:bachelor'?s?|bsc|b\.sc|degree|undergraduate|graduate)\b/i, 3],
  [/\b(?:diploma|higher national|hnd|nvq)\b/i, 2], [/\b(?:certificate|certification|a\/l|advanced level)\b/i, 1], [/\b(?:o\/l|ordinary level|high school|secondary school|gcse)\b/i, 0.5],
];
const educationLevel = (text: string): EducationLevel | null => { let best: EducationLevel | null = null; for (const [pattern, level] of EDUCATION) if (pattern.test(text) && (best === null || level > best)) best = level; return best; };

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
function yearsIn(text: string): number | null {
  const found = [...text.matchAll(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)\b/gi)].map(match => { const raw = match[1]!.toLowerCase(); return WORD_NUMBERS[raw] ?? Number(raw); });
  return found.length ? Math.max(...found) : null;
}

export function parseRequirements(jobText: string): Requirement[] {
  const lines = jobText.replace(/\r\n?/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
  const heading = /^(?:#+\s*)?(?:requirements?|qualifications?|what you(?:'|’)ll need|what we(?:'|’)re looking for|you (?:have|will have|should have)|skills(?: and experience)?|essential|desirable|must have|key requirements)\b[:\s]*$/i;
  const start = lines.findIndex(line => heading.test(line.replace(/[:：]\s*$/, "")));
  let scope: string[];
  if (start >= 0) {
    const rest = lines.slice(start + 1);
    const stop = rest.findIndex(line => /^(?:#+\s*)?(?:benefits?|salary|about (?:us|the company)|responsibilit\w+|how to apply|we offer|what we offer|compensation|duties)\b[:\s]*$/i.test(line));
    scope = stop >= 0 ? rest.slice(0, stop) : rest;
  } else scope = lines.filter(line => /^(?:[-•*]|\d+[.)])\s+/.test(line) || /\b(?:years?|degree|diploma|certificate|experience in|knowledge of|proficien\w+|must|required)\b/i.test(line));
  const out: Requirement[] = [];
  for (const raw of scope) {
    const text = raw.replace(/^(?:[-•*]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim();
    if (text.length < 3 || text.length > 300 || heading.test(text)) continue;
    const mandatory = !/\b(?:preferred|desirable|nice to have|an advantage|a plus|bonus|optional)\b/i.test(text);
    const level = educationLevel(text), years = yearsIn(text);
    const kind: Requirement["kind"] = level !== null && !years ? "education" : years !== null ? "experience" : "skill";
    out.push({ id: `r${out.length + 1}`, text, kind, mandatory, years, level, terms: significant(text.replace(/\b\d+\s*\+?\s*(?:years?|yrs?)\b/gi, "")) });
    if (out.length >= 40) break;
  }
  return out;
}

export function compareQualifications(profileText: string, jobText: string, explicit?: { years?: number | null }): QualificationResult {
  const profile = profileText.replace(/\r\n?/g, "\n");
  const profileLines = profile.split("\n").map(line => line.trim()).filter(Boolean);
  const profileTerms = new Map<string, string>();
  for (const line of profileLines) for (const term of significant(line)) if (!profileTerms.has(term)) profileTerms.set(term, line);
  const profileYears = explicit?.years ?? yearsIn(profile);
  const profileLevel = educationLevel(profile);
  const matches: Match[] = [], gaps: Gap[] = [], unclear: QualificationResult["unclear"] = [];
  for (const requirement of parseRequirements(jobText)) {
    if (requirement.kind === "education") {
      if (profileLevel === null) gaps.push({ requirement, reason: "Your text does not mention any education or certificate.", suggestion: "If you have relevant study or a certificate, add it with the name and year. If not, ask whether equivalent experience is accepted." });
      else if (profileLevel >= (requirement.level ?? 0)) matches.push({ requirement, evidence: profileLines.find(line => educationLevel(line) === profileLevel) ?? profileLines[0]!, matchedTerms: [] });
      else gaps.push({ requirement, reason: "The education you listed looks lower than the level asked for.", suggestion: "Ask whether experience can stand in for the qualification, or whether the employer supports further study." });
      continue;
    }
    if (requirement.kind === "experience" && requirement.years) {
      const termsLeft = requirement.terms;
      const related = termsLeft.filter(term => profileTerms.has(term));
      if (profileYears === null) unclear.push({ requirement, reason: "Your text does not say how many years of experience you have." });
      else if (profileYears >= requirement.years && (termsLeft.length === 0 || related.length > 0)) matches.push({ requirement, evidence: profileLines.find(line => yearsIn(line) === profileYears) ?? profileLines.find(line => related.some(term => significant(line).includes(term))) ?? profileLines[0]!, matchedTerms: related });
      else if (profileYears >= requirement.years) gaps.push({ requirement, reason: `You mention ${profileYears} years, but nothing in your text connects them to this requirement.`, suggestion: "Say which of your past work counts towards it, with the role and dates." });
      else gaps.push({ requirement, reason: `The requirement is ${requirement.years} years and you mention ${profileYears}.`, suggestion: "Highlight related projects, training or volunteering, and ask whether the requirement is flexible." });
      continue;
    }
    if (!requirement.terms.length) { unclear.push({ requirement, reason: "This requirement has no specific skill that can be compared." }); continue; }
    const hit = requirement.terms.filter(term => profileTerms.has(term));
    if (hit.length > 0 && hit.length / requirement.terms.length >= 0.5) matches.push({ requirement, evidence: profileTerms.get(hit[0]!)!, matchedTerms: hit });
    else gaps.push({ requirement, reason: hit.length ? "Only part of this requirement appears in your text." : "Your text does not mention this.", suggestion: "If you have this, add a concrete example (where, when, what you did). If not, ask whether it can be learned on the job, or practise it on a small project or short course." });
  }
  return { matches, gaps, unclear, profile: { years: profileYears, educationLevel: profileLevel, wordCount: profile.split(/\s+/).filter(Boolean).length }, limitations: LIMITS };
}

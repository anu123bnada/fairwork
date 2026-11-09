import type { CvContent } from "./schema";

// CV Analyzer: fixed rules on what the person typed, with a score whose every point is explained. It is NOT AI and it verifies nothing: it cannot tell whether a claim is true.
// Findings say what to improve and why; the optional job description only produces a list of the job's terms that the CV does or does not mention.
export type CvSeverity = "high" | "medium" | "low";
export type CvFinding = { id: string; area: string; severity: CvSeverity; title: string; detail: string; fix: string };
export type CvSection = { id: string; points: number; max: number };
export type CvAnalysis = {
  score: number; sections: CvSection[]; findings: CvFinding[]; atsNotes: string[];
  keywords: { provided: boolean; matched: string[]; missing: string[]; coverage: number | null };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NUMBER_IN_TEXT = /\d/;
const STOP = new Set(("a an the and or but if of in on at to for from by with without as is are was were be been being it its this that these those you your we our they their he she his her i me my not no yes do does did done have has had will would can could should may might must shall about above across after again against all also among any because before between both each few more most other over same some such than then there through under until up very while who whom what when where why how into out off only own so too just etc per via").split(" "));
const GENERIC = new Set(("experience experienced work working worked team teams company role roles job jobs position positions candidate candidates required require requires requirement requirements responsibilities responsibility ability able strong good great excellent skills skill knowledge years year month months including include includes ensure ensuring support provide providing looking join apply applicants applicant offer offers opportunity benefits salary full time part permanent contract based within across help helps using use used need needs needed plus preferred minimum degree").split(" "));

const clean = (value: string) => value.trim();
const tokens = (text: string) => (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.]*/g) ?? []).map(word => word.replace(/\.+$/, "")).filter(Boolean);
const singular = (word: string) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);
const dateShape = (value: string) => /^\d{4}$/.test(value) ? "year" : /^[A-Za-z]{3,9}\.? \d{4}$/.test(value) ? "month-year" : /^\d{1,2}[/-]\d{4}$/.test(value) ? "numeric" : /^\d{4}-\d{2}$/.test(value) ? "iso" : "other";

export function cvText(content: CvContent): string {
  return [content.summary, content.skills.join(" "), content.achievements.join(" "),
    ...content.experience.flatMap(x => [x.role, x.employer, x.details]), ...content.education.flatMap(x => [x.qualification, x.school, x.notes]),
    ...content.projects.flatMap(x => [x.name, x.description]), ...content.certifications.flatMap(x => [x.name, x.issuer])].join(" ");
}

// The job's most frequent meaningful words, ordered by frequency then length. Generic hiring words are ignored so the list is about the work.
export function jobTerms(jobText: string, limit = 25): string[] {
  const counts = new Map<string, number>();
  for (const word of tokens(jobText.slice(0, 6000))) {
    const base = singular(word);
    if (base.length < 3 || STOP.has(base) || GENERIC.has(base) || /^\d+$/.test(base)) continue;
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || (a[0] < b[0] ? -1 : 1)).slice(0, limit).map(([word]) => word);
}

export function analyzeCv(content: CvContent, options: { jobDescription?: string } = {}): CvAnalysis {
  const findings: CvFinding[] = [];
  const add = (severity: CvSeverity, area: string, id: string, title: string, detail: string, fix: string) => findings.push({ id, area, severity, title, detail, fix });
  const sections: CvSection[] = [];
  const b = content.basics;

  // Contact (15)
  let contact = 0;
  if (clean(b.fullName)) contact += 6; else add("high", "contact", "name-missing", "Your name is missing", "A CV without a name cannot be matched to you.", "Enter your full name under Contact details.");
  const emailOk = clean(b.email) !== "" && EMAIL.test(clean(b.email)), phoneOk = clean(b.phone).replace(/\D/g, "").length >= 7;
  if (emailOk || phoneOk) contact += 6;
  else add("high", "contact", "contact-missing", "No usable way to contact you", clean(b.email) ? "The email address does not look valid." : "Neither an email address nor a phone number is given.", "Add a valid email address or a phone number.");
  if (clean(b.email) && !emailOk && phoneOk) add("medium", "contact", "email-invalid", "The email address does not look valid", "Employers may be unable to reply by email.", "Check the spelling of the email address.");
  if (clean(b.location)) contact += 3; else add("low", "contact", "location-missing", "No location", "Many employers filter by location.", "Add your town or country.");
  sections.push({ id: "contact", points: contact, max: 15 });

  // Summary (15)
  const summaryLength = clean(content.summary).length;
  const summary = summaryLength === 0 ? 0 : summaryLength < 100 ? 7 : summaryLength <= 700 ? 15 : 10;
  if (summaryLength === 0) add("medium", "summary", "summary-missing", "No professional summary", "A two to four sentence summary tells a reader who you are before they read the rest.", "Write a short summary of your skills and what you are looking for. Only state what is true.");
  else if (summaryLength < 100) add("low", "summary", "summary-short", "The summary is very short", `It has ${summaryLength} characters.`, "Aim for two to four sentences (about 100 to 600 characters).");
  else if (summaryLength > 700) add("low", "summary", "summary-long", "The summary is long", `It has ${summaryLength} characters; readers tend to skim.`, "Shorten it to the points that matter most for the role.");
  sections.push({ id: "summary", points: summary, max: 15 });

  // Experience (25)
  let experience = 0;
  if (content.experience.length === 0) {
    add(content.education.length ? "medium" : "high", "experience", "experience-none", "No experience listed", "Employers look for work, training or project experience first.", "Add jobs, internships, volunteering or projects. If you have none yet, add projects and training.");
  } else {
    experience = 10;
    for (const [index, entry] of content.experience.slice(0, 3).entries()) {
      const complete = clean(entry.role) && clean(entry.employer) && clean(entry.start) && clean(entry.details);
      if (complete) experience += 5;
      else add("medium", "experience", `experience-${index}-incomplete`, `Experience ${index + 1} is incomplete`, "A role, an employer, a start date and a short description are all expected.", "Fill in the missing details for this entry.");
    }
    for (const [index, entry] of content.experience.entries()) {
      if (clean(entry.start) && !clean(entry.end)) add("low", "dates", `experience-${index}-end`, `Experience ${index + 1} has no end date`, "Without an end date a reader cannot tell whether it is current.", "Add an end date, or write \"Present\" if it is your current role.");
    }
    if (!content.experience.some(entry => NUMBER_IN_TEXT.test(entry.details))) add("low", "experience", "no-numbers", "No measurable results", "None of the descriptions contains a number (for example hours, people, amounts or percentages).", "Where true, add figures such as how many items, customers or hours you handled.");
  }
  sections.push({ id: "experience", points: experience, max: 25 });

  // Education (10)
  const education = content.education.some(entry => clean(entry.qualification) || clean(entry.school)) ? 10 : 0;
  if (!education) add("low", "education", "education-none", "No education or training listed", "Qualifications and training help when experience is short.", "Add your school, qualification or training courses.");
  sections.push({ id: "education", points: education, max: 10 });

  // Skills (15)
  const skillCount = content.skills.length;
  const skills = skillCount >= 8 ? 15 : skillCount >= 5 ? 12 : skillCount >= 3 ? 8 : skillCount >= 1 ? 4 : 0;
  if (skillCount < 5) add(skillCount === 0 ? "medium" : "low", "skills", "skills-few", skillCount === 0 ? "No skills listed" : "Few skills listed", `You listed ${skillCount}.`, "List the skills you genuinely have, ideally five to fifteen, using the words employers use.");
  const lowered = content.skills.map(skill => skill.trim().toLowerCase());
  if (new Set(lowered).size < lowered.length) add("low", "skills", "skills-duplicate", "Some skills are listed twice", "Repeats make the list look padded.", "Remove the duplicates.");
  if (skillCount > 25) add("low", "skills", "skills-many", "Very long skills list", "More than 25 skills is hard to read and hard to believe.", "Keep the strongest and most relevant ones.");
  sections.push({ id: "skills", points: skills, max: 15 });

  // Projects, achievements, certifications (10)
  const extras = [content.projects.length, content.achievements.length, content.certifications.length].filter(count => count > 0).length;
  if (extras === 0) add("low", "extras", "extras-none", "No projects, achievements or certifications", "These show evidence of what you can do.", "Add a project, an achievement or a certificate if you have one.");
  sections.push({ id: "extras", points: extras === 0 ? 0 : extras === 1 ? 4 : extras === 2 ? 7 : 10, max: 10 });

  // Links (5)
  const links = content.basics.links.some(link => clean(link.url)) || content.projects.some(project => clean(project.link)) ? 5 : 0;
  if (!links) add("low", "links", "links-none", "No links", "A portfolio or profile link lets a reader see more.", "Add a link to your work, if you have one.");
  sections.push({ id: "links", points: links, max: 5 });

  // Whole-document checks
  const textLength = cvText(content).length;
  if (textLength > 7000) add("medium", "length", "too-long", "The CV is probably longer than two pages", `It has about ${textLength} characters of content.`, "Cut older or less relevant entries and keep each description short.");
  const shapes = new Set([...content.experience, ...content.education].flatMap(entry => [entry.start, entry.end]).map(clean).filter(value => value && !/^present$/i.test(value)).map(dateShape));
  if (shapes.size > 1) add("low", "dates", "dates-mixed", "Dates are written in different formats", "Mixed formats look careless and can confuse automated readers.", "Use one format throughout, for example \"Mar 2024\" or \"2024\".");

  // Job description comparison (terms only, never a judgement about the person)
  const provided = clean(options.jobDescription ?? "").length > 0;
  const terms = provided ? jobTerms(options.jobDescription!) : [];
  const cvWords = new Set(tokens(cvText(content)).map(singular));
  const matched = terms.filter(term => cvWords.has(term));
  const missing = terms.filter(term => !cvWords.has(term)).slice(0, 12);
  const coverage = terms.length ? Math.round((100 * matched.length) / terms.length) : null;
  if (provided && coverage !== null && coverage < 40) add("medium", "keywords", "low-keyword-coverage", "Your CV mentions few of the job's key terms", `${matched.length} of the job's ${terms.length} most frequent terms appear in your CV.`, "Where it is true, use the job's own words for the skills and tasks you have done. Do not add terms you cannot back up.");

  const atsNotes = [
    "ORYQEN prints a CV as one column of plain text with standard headings, which applicant tracking systems read well. If you export it elsewhere, avoid tables, text boxes, images of text and headers or footers that hold contact details.",
    "Use a standard file type (PDF or Word), normal section names (Experience, Education, Skills) and the same date format throughout.",
  ];
  const total = sections.reduce((sum, section) => sum + section.points, 0), max = sections.reduce((sum, section) => sum + section.max, 0);
  const order = { high: 0, medium: 1, low: 2 } as const;
  findings.sort((a, b2) => order[a.severity] - order[b2.severity]);
  return { score: Math.round((100 * total) / max), sections, findings, atsNotes, keywords: { provided, matched, missing, coverage } };
}

import { sampleCareers } from "./sample-data";

// ORYQEN reference framework: an editorial list of what is commonly asked for in a role, written by the ORYQEN team for the exhibition build. It is NOT labour-market data, NOT an official
// occupation standard and NOT verified by any employer, regulator or licensing body. The skills come from the sample career framework; the reasons and qualification notes were added for
// the career gap analyzer. Whether a qualification is required depends on the country and the employer, so each one says where to check. Every screen that shows it must say this.
export type Importance = "essential" | "helpful";
export type RefSkill = { name: string; importance: Importance; why: string };
export type RefQualification = { name: string; kind: "academic" | "professional" | "certification" | "licence"; importance: Importance; regulated: boolean; why: string };
export type RefCareer = { id: string; title: string; summary: string; skills: RefSkill[]; qualifications: RefQualification[] };

const CHECK = "Requirements differ by country and employer; confirm with the official licensing or training authority and the employer.";
const s = (name: string, importance: Importance, why: string): RefSkill => ({ name, importance, why });
const q = (name: string, kind: RefQualification["kind"], importance: Importance, regulated: boolean, why: string): RefQualification => ({ name, kind, importance, regulated, why });

// One sentence per skill on why it matters for the role. Skills not listed here fall back to a plain statement that the sample framework treats it as part of the role.
const why: Record<string, Record<string, string>> = {
  welder: { "MIG welding": "It is the most common welding process in workshops, so most entry jobs expect it.", "Reading drawings": "Welds must follow the drawing: position, size and joint type.", "Safe work": "Heat, fumes and sparks make safe habits a condition of working at all.", "Arc welding": "Some sites use it for thicker or outdoor work.", "Metal cutting": "Preparing and trimming metal is part of most welding jobs." },
  electrician: { "Wiring": "Installing and repairing circuits is the core of the work.", "Safe work": "Mistakes with electricity can seriously injure people, so safety is non-negotiable.", "Reading circuit diagrams": "Diagrams show how a circuit must be connected and tested.", "Testing equipment": "Testing proves that work is safe before it is switched on.", "Customer service": "Most work happens in other people's homes and businesses." },
  "retail-assistant": { "Customer service": "Serving customers politely is the main task.", "Cash handling": "Tills must balance; errors cost the shop and the employee.", "Stock counting": "Accurate counts keep shelves full and losses visible.", "Point of sale system": "Most shops use a till system for sales and returns.", "Teamwork": "Shifts depend on colleagues covering for each other." },
  "shop-supervisor": { "Customer service": "Supervisors handle the difficult customer cases.", "Cash handling": "They open, close and balance the shop's takings.", "Team leading": "The role is mainly about directing a small team.", "Scheduling shifts": "Staff cover has to match opening hours and busy times.", "Stock counting": "They check and sign off stock differences." },
  "customer-support": { "Clear writing": "Most support is written, so replies must be short and unambiguous.", "Customer service": "Calm, polite handling keeps upset customers from escalating.", "Problem solving": "Customers expect the issue to be fixed, not just acknowledged.", "Typing": "Chat support rewards speed and accuracy.", "Using a ticket system": "Teams track every request in a ticket tool." },
  "accounts-clerk": { "Bookkeeping": "Recording receipts and payments correctly is the job.", "Spreadsheets": "Most small books are kept in spreadsheets.", "Attention to detail": "A wrong digit can carry through a whole set of books.", "Invoicing": "Clerks raise and chase invoices.", "Basic tax rules": "Books feed tax returns, so basic rules matter." },
  "junior-web-developer": { "HTML": "It is the structure of every web page.", "CSS": "It controls layout and appearance on phones and desktops.", "JavaScript": "It makes pages interactive; junior roles nearly always use it.", "Version control": "Teams share and review code through version control.", "Testing": "Automated checks catch mistakes before users do.", "Accessibility": "Pages must work for keyboard and screen-reader users." },
  driver: { "Valid licence": "Driving for work requires the licence class for the vehicle.", "Route planning": "Good routes save time and fuel and keep deliveries on schedule.", "Safe driving": "Safety protects people and the employer's insurance.", "Vehicle checks": "Daily checks catch faults before they cause accidents.", "Customer service": "Drivers are often the only person the customer meets." },
  "site-supervisor": { "Team leading": "The supervisor directs the crew day to day.", "Safe work": "The supervisor is responsible for site safety.", "Reading drawings": "Work must be checked against the drawings.", "Scheduling shifts": "Crew and materials must arrive when needed.", "Reporting": "Daily reports record progress and incidents." },
};

const qualifications: Record<string, RefQualification[]> = {
  welder: [q("Workplace safety training certificate", "certification", "essential", false, `Employers usually ask for proof of basic safety training. ${CHECK}`), q("Recognised welding certification", "professional", "helpful", false, `Some employers and projects ask for a tested welding certificate. ${CHECK}`)],
  electrician: [q("Electrical trade licence or registration", "licence", "essential", true, `Most countries regulate who may carry out electrical work. A course alone does not give this licence. ${CHECK}`), q("Electrical safety training", "certification", "essential", false, `Safety training is normally required alongside any licence. ${CHECK}`)],
  "retail-assistant": [],
  "shop-supervisor": [q("Previous retail or team experience", "professional", "helpful", false, "Employers usually prefer people who have worked in a shop; this is experience, not a certificate.")],
  "customer-support": [],
  "accounts-clerk": [q("Bookkeeping or basic accounting certificate", "academic", "helpful", false, `Many employers ask for one; some accept experience instead. ${CHECK}`)],
  "junior-web-developer": [],
  driver: [q("Driving licence for the vehicle class", "licence", "essential", true, `Driving for work is regulated by law. A course does not replace the licence. ${CHECK}`)],
  "site-supervisor": [q("Site safety supervisor certificate", "certification", "essential", false, `Sites usually require a recognised supervisor safety certificate. ${CHECK}`), q("Previous site experience", "professional", "essential", false, "Supervisors are normally promoted from, or hired with, site experience; it is experience, not a certificate.")],
};

const fromSample: RefCareer[] = sampleCareers.map(career => ({
  id: career.id, title: career.title, summary: career.summary,
  skills: career.skills.map(skill => s(skill.name, skill.weight === "core" ? "essential" : "helpful", why[career.id]?.[skill.name] ?? "The ORYQEN sample framework lists it as part of this role.")),
  qualifications: qualifications[career.id] ?? [],
}));

const dataAnalyst: RefCareer = {
  id: "junior-data-analyst", title: "Junior data analyst", summary: "Cleans, queries and presents data to answer practical questions for a team.",
  skills: [
    s("Spreadsheets", "essential", "Many first analysis jobs start in spreadsheets."),
    s("SQL", "essential", "Most company data sits in databases that are read with SQL."),
    s("Python", "helpful", "Python is widely used for repeatable analysis, but some entry roles use only spreadsheets and SQL."),
    s("Data cleaning", "essential", "Real data is messy; cleaning it is most of the work."),
    s("Data visualization", "essential", "Results must be shown in a form colleagues can read."),
    s("Data analysis", "helpful", "Working with tables in code (for example pandas) speeds up repeat work."),
    s("Clear writing", "helpful", "Findings only help when others can understand them."),
  ],
  qualifications: [q("Degree or diploma in a quantitative subject", "academic", "helpful", false, `Many employers ask for one; some hire on demonstrated skills. ${CHECK}`)],
};

export const referenceCareers: readonly RefCareer[] = [...fromSample, dataAnalyst];
export const referenceCareerById = (id: string) => referenceCareers.find(career => career.id === id) ?? null;
/** Match a free-text goal to a framework role by exact title (case-insensitive). Anything else is a custom goal with no reference framework. */
export const referenceCareerByTitle = (title: string) => referenceCareers.find(career => career.title.toLowerCase() === title.trim().toLowerCase()) ?? null;
export const FRAMEWORK_LABEL = "ORYQEN reference framework (editorial, for demonstration; not labour-market data, not an official standard, not verified by any employer or regulator)";

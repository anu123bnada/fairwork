// Jurisdiction reference registry (module 16).
//
// RULES FOR THIS FILE
//  - A rule enters only with its primary-source wording, URL, retrieval date and scope. Nothing here
//    is written from memory, and nothing is generalized beyond what the cited text says.
//  - Where a primary source could not be retrieved, the jurisdiction is listed as `source_unavailable`
//    with the reason, never with guessed thresholds.
//  - These references support a user's own review. They are not legal advice and are not reviewed by counsel.

export type SourceStatus = "unofficial_consolidation" | "official_text";
export type RuleReference = {
  id: string;
  topic: "daily_working_time" | "rest_breaks" | "rest_period" | "annual_leave" | "notice_period";
  sourceTitle: string;
  publisher: string;
  sourceUrl: string;
  /** Exact wording as retrieved, in the source language. */
  quote: string;
  quoteLanguage: "de" | "en";
  summary: string;
  retrievedOn: string;
  /** Publication or "as of" date, only when the source states one. */
  sourceDate: string | null;
  sourceStatus: SourceStatus;
  scope: string;
  validity: { from: string | null; to: string | null; note: string };
  parameters: Record<string, number>;
};
export type JurisdictionEntry =
  | { country: string; name: string; support: "supported"; terminology: Record<string, string>; rules: RuleReference[]; limitations: string[] }
  | { country: string; name: string; support: "source_unavailable"; reason: string; whereToCheck: { title: string; url: string }[] };

const arbzgPublisher = "Bundesministerium der Justiz / juris GmbH (gesetze-im-internet.de)";
const arbzgNote = "The page labels its table of contents as non-official ('Nichtamtlich') and shows no 'as of' date; amendments after retrieval are not reflected.";

export const GERMANY: JurisdictionEntry = {
  country: "DE", name: "Germany", support: "supported",
  terminology: { "working time": "Arbeitszeit", "break": "Ruhepause", "weekday (Mon-Sat)": "Werktag", "employee": "Arbeitnehmer" },
  rules: [
    {
      id: "de-arbzg-3", topic: "daily_working_time", sourceTitle: "Arbeitszeitgesetz (ArbZG) § 3 Arbeitszeit der Arbeitnehmer", publisher: arbzgPublisher,
      sourceUrl: "https://www.gesetze-im-internet.de/arbzg/__3.html",
      quote: "Die werktägliche Arbeitszeit der Arbeitnehmer darf acht Stunden nicht überschreiten. Sie kann auf bis zu zehn Stunden nur verlängert werden, wenn innerhalb von sechs Kalendermonaten oder innerhalb von 24 Wochen im Durchschnitt acht Stunden werktäglich nicht überschritten werden.",
      quoteLanguage: "de",
      summary: "Daily working time may not exceed 8 hours. It may be extended to at most 10 hours only if the average over six calendar months or 24 weeks does not exceed 8 hours per working day.",
      retrievedOn: "2026-10-26", sourceDate: null, sourceStatus: "unofficial_consolidation",
      scope: "Germany (federal). Employees covered by the Arbeitszeitgesetz; the Act contains further provisions and exceptions that this check does not evaluate.",
      validity: { from: null, to: null, note: arbzgNote },
      parameters: { maxDailyHours: 8, extendedMaxDailyHours: 10, averagingMonths: 6, averagingWeeks: 24 },
    },
    {
      id: "de-arbzg-4", topic: "rest_breaks", sourceTitle: "Arbeitszeitgesetz (ArbZG) § 4 Ruhepausen", publisher: arbzgPublisher,
      sourceUrl: "https://www.gesetze-im-internet.de/arbzg/__4.html",
      quote: "Die Arbeit ist durch im voraus feststehende Ruhepausen von mindestens 30 Minuten bei einer Arbeitszeit von mehr als sechs bis zu neun Stunden und 45 Minuten bei einer Arbeitszeit von mehr als neun Stunden insgesamt zu unterbrechen. Die Ruhepausen nach Satz 1 können in Zeitabschnitte von jeweils mindestens 15 Minuten aufgeteilt werden. Länger als sechs Stunden hintereinander dürfen Arbeitnehmer nicht ohne Ruhepause beschäftigt werden.",
      quoteLanguage: "de",
      summary: "Work must be interrupted by pre-arranged breaks of at least 30 minutes when working time is more than 6 and up to 9 hours, and at least 45 minutes when it is more than 9 hours. Breaks may be split into blocks of at least 15 minutes. No one may work more than 6 hours in a row without a break.",
      retrievedOn: "2026-10-26", sourceDate: null, sourceStatus: "unofficial_consolidation",
      scope: "Germany (federal). Employees covered by the Arbeitszeitgesetz; exceptions elsewhere in the Act are not evaluated here.",
      validity: { from: null, to: null, note: arbzgNote },
      parameters: { breakMinutesOver6h: 30, breakMinutesOver9h: 45, minBlockMinutes: 15, maxHoursWithoutBreak: 6 },
    },
    {
      id: "de-arbzg-5", topic: "rest_period", sourceTitle: "Arbeitszeitgesetz (ArbZG) § 5 Ruhezeit", publisher: arbzgPublisher,
      sourceUrl: "https://www.gesetze-im-internet.de/arbzg/__5.html",
      quote: "Die Arbeitnehmer müssen nach Beendigung der täglichen Arbeitszeit eine ununterbrochene Ruhezeit von mindestens elf Stunden haben.",
      quoteLanguage: "de",
      summary: "After the end of daily working time employees must have an uninterrupted rest period of at least 11 hours. (Paragraph 5(1); the Act lists exceptions in the following paragraphs that this reference does not evaluate.)",
      retrievedOn: "2026-10-26", sourceDate: null, sourceStatus: "unofficial_consolidation",
      scope: "Germany (federal). Employees covered by the Arbeitszeitgesetz; paragraph 5(2) and (3) and other sections contain exceptions that are not evaluated here.",
      validity: { from: null, to: null, note: arbzgNote },
      parameters: { minRestHours: 11 },
    },
    {
      id: "de-burlg-3", topic: "annual_leave", sourceTitle: "Bundesurlaubsgesetz (BUrlG) § 3 Dauer des Urlaubs", publisher: arbzgPublisher,
      sourceUrl: "https://www.gesetze-im-internet.de/burlg/__3.html",
      quote: "Der Urlaub beträgt jährlich mindestens 24 Werktage. Als Werktage gelten alle Kalendertage, die nicht Sonn- oder gesetzliche Feiertage sind.",
      quoteLanguage: "de",
      summary: "Annual leave is at least 24 Werktage. Werktage are all calendar days that are not Sundays or public holidays, so Monday to Saturday count. This is a statutory minimum; contracts and collective agreements may give more.",
      retrievedOn: "2026-10-26", sourceDate: null, sourceStatus: "unofficial_consolidation",
      scope: "Germany (federal). Employees covered by the Bundesurlaubsgesetz; the 24 days assume a six-day working week and the Act contains further provisions (part-year entitlement, carry-over) not evaluated here.",
      validity: { from: null, to: null, note: "The page labels its table of contents as non-official ('Nichtamtlich') and shows no 'as of' date; amendments after retrieval are not reflected." },
      parameters: { minLeaveWerktage: 24, werktageBasisDaysPerWeek: 6 },
    },
    {
      id: "de-bgb-622", topic: "notice_period", sourceTitle: "Bürgerliches Gesetzbuch (BGB) § 622 Kündigungsfristen bei Arbeitsverhältnissen", publisher: arbzgPublisher,
      sourceUrl: "https://www.gesetze-im-internet.de/bgb/__622.html",
      quote: "Das Arbeitsverhältnis eines Arbeiters oder eines Angestellten (Arbeitnehmers) kann mit einer Frist von vier Wochen zum Fünfzehnten oder zum Ende eines Kalendermonats gekündigt werden. Für eine Kündigung durch den Arbeitgeber beträgt die Kündigungsfrist, wenn das Arbeitsverhältnis in dem Betrieb oder Unternehmen zwei Jahre bestanden hat, einen Monat zum Ende eines Kalendermonats, fünf Jahre bestanden hat, zwei Monate zum Ende eines Kalendermonats, acht Jahre bestanden hat, drei Monate zum Ende eines Kalendermonats, zehn Jahre bestanden hat, vier Monate zum Ende eines Kalendermonats, zwölf Jahre bestanden hat, fünf Monate zum Ende eines Kalendermonats, 15 Jahre bestanden hat, sechs Monate zum Ende eines Kalendermonats, 20 Jahre bestanden hat, sieben Monate zum Ende eines Kalendermonats.",
      quoteLanguage: "de",
      summary: "The basic notice period is four weeks to the 15th or the end of a calendar month. When the employer gives notice, the period grows with length of service: 1 month after 2 years, 2 after 5, 3 after 8, 4 after 10, 5 after 12, 6 after 15 and 7 months after 20 years, each to the end of a calendar month. (Paragraph 622(1) and (2) as retrieved; the quotation joins the retrieved segments. Paragraphs on probation, small employers and contracts are not evaluated.)",
      retrievedOn: "2026-10-26", sourceDate: null, sourceStatus: "unofficial_consolidation",
      scope: "Germany (federal), statutory default for employment contracts. Probation periods, very small employers, collective agreements and contract terms can change the notice period; this reference does not evaluate them.",
      validity: { from: null, to: null, note: "The page labels its table of contents as non-official ('Nichtamtlich') and shows no 'as of' date; amendments after retrieval are not reflected." },
      parameters: { basicNoticeWeeks: 4, employerNoticeMonthsAfter2y: 1, employerNoticeMonthsAfter5y: 2, employerNoticeMonthsAfter8y: 3, employerNoticeMonthsAfter10y: 4, employerNoticeMonthsAfter12y: 5, employerNoticeMonthsAfter15y: 6, employerNoticeMonthsAfter20y: 7 },
    },
  ],
  limitations: [
    "Covered: daily working time, rest breaks, the 11-hour rest period, the statutory minimum leave and the statutory notice periods. Pay (including the minimum wage), overtime pay, sick pay, probation, part-time rules and every other topic are not.",
    "Collective agreements, sector rules and statutory exceptions can change what applies to a particular job. A works council, union or qualified adviser can confirm.",
  ],
};

export const SRI_LANKA: JurisdictionEntry = {
  country: "LK", name: "Sri Lanka", support: "source_unavailable",
  reason: "ORYQEN has not yet verified Sri Lankan working-time or wage rules against a primary source, so it shows none. On 26 October 2026 the Department of Labour website could not be read (its security certificate had expired), and the Parliament copy retrieved was only the Shop and Office Employees (Amendment) Act No. 28 of 2024, which amends section 10 and does not contain the principal hour limits. No thresholds are shown rather than guessed.",
  whereToCheck: [
    { title: "Department of Labour: Labour Legislations (official)", url: "https://labourdept.gov.lk/labour-legislations/" },
    { title: "Parliament of Sri Lanka: Acts", url: "https://www.parliament.lk/" },
    { title: "ILO NATLEX: Shop and Office Employees (Regulation of Employment and Remuneration) Act, No. 19 of 1954", url: "https://www.ilo.org/dyn/natlex/natlex4.detail?p_lang=en&p_isn=50743" },
  ],
};

export const JURISDICTIONS: Record<string, JurisdictionEntry> = { DE: GERMANY, LK: SRI_LANKA };
export const SELECTABLE_COUNTRIES: { code: string; name: string }[] = [
  { code: "LK", name: "Sri Lanka" }, { code: "DE", name: "Germany" }, { code: "GB", name: "United Kingdom" }, { code: "IN", name: "India" },
  { code: "US", name: "United States" }, { code: "AU", name: "Australia" }, { code: "SG", name: "Singapore" }, { code: "AE", name: "United Arab Emirates" },
];
export function jurisdictionFor(country: string): JurisdictionEntry {
  return JURISDICTIONS[country] ?? {
    country, name: SELECTABLE_COUNTRIES.find(c => c.code === country)?.name ?? country, support: "source_unavailable",
    reason: "ORYQEN has no verified employment-rule references for this country yet, so it shows none.", whereToCheck: [],
  };
}
// Re-verify guidance: references older than 180 days should be re-checked against the source.
export function referenceAgeDays(rule: Pick<RuleReference, "retrievedOn">, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(rule.retrievedOn)) / 86_400_000));
}
export const REFERENCE_STALE_AFTER_DAYS = 180;

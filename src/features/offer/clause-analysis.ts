// Deterministic clause check over offer text. Every finding quotes the passage it rests on and says where it is (the page when the text
// carries "[Page N]" markers, plus character offsets). It finds wording that deserves a question; it never decides that a clause is
// unlawful, and it reads only the text it is given. The wording below is English and is shown as the engine wrote it.
export type ClauseFinding = {
  id: string;
  kind: "unclear" | "contradiction" | "promise" | "missing";
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  question: string;
  quote: string | null;
  source: { page: number | null; start: number; end: number } | null;
};
export type ClauseAnalysis = { findings: ClauseFinding[]; limitations: string };

const LIMITS = "Rule-based wording checks on the text provided. They cannot see what was agreed verbally, other documents or the law, and a clause that is not flagged is not thereby fair.";

function pageAt(text: string, offset: number): number | null {
  let page: number | null = null;
  for (const marker of text.matchAll(/\[Page (\d+)\]/g)) { if ((marker.index ?? 0) <= offset) page = Number(marker[1]); else break; }
  return page;
}
function locate(text: string, match: RegExpMatchArray) {
  const start = match.index ?? 0;
  const lineStart = text.lastIndexOf("\n", start) + 1;
  const lineEndRaw = text.indexOf("\n", start + match[0].length);
  const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
  const quote = text.slice(lineStart, lineEnd).trim().slice(0, 300);
  return { quote, source: { page: pageAt(text, start), start: lineStart, end: lineEnd } };
}

type Rule = { id: string; kind: ClauseFinding["kind"]; severity: ClauseFinding["severity"]; pattern: RegExp; title: string; explanation: string; question: string };
const RULES: Rule[] = [
  { id: "discretion-pay", kind: "unclear", severity: "medium", pattern: /\b(?:salary|pay|bonus|allowance|commission|increment)s?\b[^.\n]{0,80}\b(?:at the (?:sole )?discretion of|as determined by|decided by) (?:the )?(?:management|company|employer)\b/i, title: "Pay left to the employer's discretion", explanation: "The amount or timing of pay is not fixed by the text; the employer decides.", question: "Which part of my pay is fixed, and which part can the employer change? Please put the fixed amount in writing." },
  { id: "change-without-notice", kind: "unclear", severity: "high", pattern: /\b(?:may|can|reserves? the right to)\b[^.\n]{0,60}\b(?:change|amend|vary|modify|revise)\b[^.\n]{0,60}\b(?:without (?:prior )?notice|at any time|unilaterally)\b/i, title: "Terms can be changed without notice", explanation: "The text lets the employer change terms at any time or without telling you first.", question: "Which terms can be changed, how much notice will I get, and can I decline a change that lowers my pay or raises my hours?" },
  { id: "vague-hours", kind: "unclear", severity: "medium", pattern: /\b(?:as (?:and when )?required|as needed|flexible hours|irregular hours|when (?:needed|called)|on call|as per (?:business|operational) (?:needs|requirements))\b/i, title: "Working hours not fixed", explanation: "Hours are described as flexible or as required rather than as a number or a schedule.", question: "What are the normal hours each week, and how much notice do I get before extra hours are required?" },
  { id: "vague-overtime", kind: "unclear", severity: "medium", pattern: /\b(?:reasonable|necessary|occasional|additional|extra) (?:overtime|hours)\b|\bovertime\b[^.\n]{0,40}\b(?:as required|if required|may be required|included)\b/i, title: "Overtime described loosely", explanation: "Overtime is mentioned without a stated rate or limit, or is said to be included in pay.", question: "Is overtime paid, at what rate, and is there a maximum number of overtime hours?" },
  { id: "vague-duties", kind: "unclear", severity: "low", pattern: /\b(?:any other duties|such other duties|other duties as (?:assigned|required)|duties may vary|any (?:reasonable )?task)\b/i, title: "Open-ended duties", explanation: "The role can include any other work the employer assigns.", question: "Can you list the main duties, and is there a limit to how far other duties can differ from them?" },
  { id: "vague-benefits", kind: "unclear", severity: "low", pattern: /\b(?:benefits|perks|allowances?)\b[^.\n]{0,40}\b(?:to be (?:discussed|decided|confirmed)|tbc|tbd|negotiable|subject to (?:company )?policy)\b/i, title: "Benefits not stated", explanation: "Benefits are promised but their content is left for later or to policy.", question: "Which benefits do I get from the first day, and can I see the policy that governs them?" },
  { id: "deduction-open", kind: "unclear", severity: "high", pattern: /\b(?:deduct(?:ed|ions?)?|recover(?:ed|y)?|withheld?)\b[^.\n]{0,80}\b(?:any|all|damages?|losses|costs?|equipment|uniform|training)\b/i, title: "Open-ended deductions", explanation: "Money may be taken from pay for damages, costs or equipment, without a stated limit or process.", question: "Exactly which deductions can be made, up to what amount, and what happens if I disagree with one?" },
  { id: "bond-penalty", kind: "unclear", severity: "high", pattern: /\b(?:bond|liquidated damages|penalty|forfeit(?:ed|ure)?|refund (?:of )?(?:training|recruitment))\b[^.\n]{0,80}\b(?:(?:resign|leave|terminate|quit)(?:s|ed)?|early|before)\b|\b(?:resign|leave|quit)(?:s|ed)?\b[^.\n]{0,80}\b(?:bond|penalty|forfeit|pay back|repay)\b/i, title: "Penalty for leaving", explanation: "Leaving early can cost you money (a bond, a repayment or a forfeited amount).", question: "What is the amount, what is it for, how does it reduce over time, and is it allowed where I will work?" },
  { id: "one-sided-termination", kind: "unclear", severity: "medium", pattern: /\b(?:terminate|dismiss)\b[^.\n]{0,60}\b(?:at any time|without (?:cause|reason|notice)|immediately)\b|\bemployer\b[^.\n]{0,40}\b(?:sole|absolute) discretion\b/i, title: "Termination terms favour the employer", explanation: "The employer can end the job at any time or without a reason or notice.", question: "How much notice does each side give, and in which cases can the job end immediately?" },
  { id: "non-compete", kind: "unclear", severity: "medium", pattern: /\b(?:non[- ]?compet\w+|restraint of trade|shall not (?:work|be employed) (?:for|with) (?:any )?(?:competitor|other))/i, title: "Restriction on future work", explanation: "The text limits who you can work for after (or during) this job.", question: "How long does the restriction last, what area and work does it cover, and is any pay given for it?" },
  { id: "promise-guaranteed", kind: "promise", severity: "high", pattern: /\bguarantee(?:d|s)?\b[^.\n]{0,60}\b(?:job|income|salary|earnings|visa|placement|promotion|bonus|profit|return)s?\b|\b(?:job|income|salary|earnings|visa|placement|profit)s?\b[^.\n]{0,30}\bguarantee(?:d)?\b|\b(?:100%|risk[- ]free)\b[^.\n]{0,40}\b(?:job|income|earn|profit|guarantee)\b/i, title: "Guarantee that is hard to keep", explanation: "A guaranteed job, income, visa or return is promised. Real employers rarely guarantee these.", question: "Where is this guarantee written as a binding term, and what happens if it is not met?" },
  { id: "promise-easy-money", kind: "promise", severity: "high", pattern: /\b(?:earn|make)\b[^.\n]{0,30}\b(?:up to|upto|as much as|unlimited|\$\s?\d[\d,]{3,}|rs\.?\s?\d[\d,]{4,})\b[^.\n]{0,40}\b(?:per (?:day|week)|daily|weekly|from home|no (?:experience|skills?|qualifications?))\b|\bno (?:experience|skills?|qualifications?) (?:needed|required|necessary)\b[^.\n]{0,80}\b(?:high|big|huge|attractive|lucrative) (?:salary|pay|income)\b/i, title: "High pay for little requirement", explanation: "Large earnings are promised with few or no requirements, a common pattern in misleading offers.", question: "How exactly is this pay calculated, who pays it and can I see an example payslip or contract before starting?" },
  { id: "promise-pay-first", kind: "promise", severity: "high", pattern: /\b(?:pay|send|transfer|deposit)\b[^.\n]{0,40}\b(?:before|prior to|to (?:secure|confirm|reserve|start))\b/i, title: "Payment asked before work starts", explanation: "You are asked to pay or send money before the job begins.", question: "Why is a payment needed before I start, who receives it and is it returned, given that a genuine employer does not usually charge to hire?" },
];

// Salary figures or weekly hours stated more than once with different values, and mutually exclusive contract wording.
function contradictions(text: string): ClauseFinding[] {
  const out: ClauseFinding[] = [];
  const distinct = new Map<number, RegExpMatchArray>();
  for (const match of text.matchAll(/\b(?:salary|pay|wage|remuneration|basic)\b[^\n.]{0,40}?(?:LKR|Rs\.?|USD|\$|EUR|€|GBP|£)\s?([0-9][0-9,]*(?:\.\d+)?)/gi)) {
    const value = Number(match[1]!.replace(/,/g, ""));
    if (value > 0 && !distinct.has(value)) distinct.set(value, match);
  }
  if (distinct.size > 1) {
    const place = locate(text, [...distinct.values()][1]!);
    out.push({ id: "contradiction-salary", kind: "contradiction", severity: "high", title: "Different pay amounts stated", explanation: `The text states more than one pay figure (${[...distinct.keys()].join(" and ")}) without saying how they relate.`, question: "Which pay figure applies to me, and what are the others (for example an allowance, a target or an earlier offer)?", quote: place.quote, source: place.source });
  }
  const hours = new Map<number, RegExpMatchArray>();
  for (const match of text.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:per|a|\/|each)\s*week\b/gi)) { const value = Number(match[1]); if (value > 0 && !hours.has(value)) hours.set(value, match); }
  if (hours.size > 1) {
    const place = locate(text, [...hours.values()][1]!);
    out.push({ id: "contradiction-hours", kind: "contradiction", severity: "medium", title: "Different weekly hours stated", explanation: `The text gives more than one weekly hours figure (${[...hours.keys()].join(" and ")}).`, question: "How many hours a week am I expected to work, and what is the other figure?", quote: place.quote, source: place.source });
  }
  const permanent = text.match(/\bpermanent\b/i);
  const fixed = text.match(/\b(?:fixed[- ]term|temporary|(?:\d+|one|two|three|six|twelve)[- ](?:month|year)s?(?:[- ]contract)?|contract (?:period|duration|for))\b/i);
  if (permanent && fixed) {
    const place = locate(text, fixed);
    out.push({ id: "contradiction-permanence", kind: "contradiction", severity: "medium", title: "Permanent and fixed-term wording together", explanation: "The text calls the job permanent and also describes a fixed or temporary period.", question: "Is this a permanent job or a fixed-term contract, and when does any fixed term end?", quote: place.quote, source: place.source });
  }
  const noProbation = text.match(/\bno probation\b/i);
  const probation = text.match(/\bprobation(?:ary)?\b[^.\n]{0,40}\b\d+\s*(?:months?|weeks?|days?)\b/i);
  if (noProbation && probation) {
    const place = locate(text, probation);
    out.push({ id: "contradiction-probation", kind: "contradiction", severity: "low", title: "Probation both excluded and described", explanation: "The text says there is no probation and also gives a probation length.", question: "Is there a probation period, and if so how long and on what terms?", quote: place.quote, source: place.source });
  }
  return out;
}

// Core terms a person needs before accepting. A term counts as present only if the text mentions it.
const EXPECTED: Array<{ id: string; title: string; pattern: RegExp; question: string; severity: ClauseFinding["severity"] }> = [
  { id: "missing-salary", title: "Pay amount not stated", pattern: /\b(?:salary|wage|pay|remuneration|stipend)\b[^\n]{0,60}\d|\d[^\n]{0,30}\b(?:per (?:hour|day|week|month|year|annum)|monthly|weekly|hourly|annual)\b/i, question: "What is the pay amount, how often is it paid, and is it before or after tax?", severity: "high" },
  { id: "missing-hours", title: "Working hours not stated", pattern: /\b\d{1,3}(?:\.\d+)?\s*(?:hours?|hrs?)\b|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b[^\n]{0,20}\b(?:to|-|–)\b|\bworking (?:hours|days)\b/i, question: "What are the working days and hours each week?", severity: "high" },
  { id: "missing-leave", title: "Leave not stated", pattern: /\b(?:annual leave|paid leave|vacation|holiday|sick leave|casual leave|days? (?:of )?leave|leave entitlement)\b/i, question: "How many days of paid annual and sick leave do I get, and from when?", severity: "medium" },
  { id: "missing-benefits", title: "Benefits not stated", pattern: /\b(?:benefits?|insurance|provident fund|epf|etf|pension|401\(?k\)?|medical|allowance|bonus|transport)\b/i, question: "Which benefits (insurance, pension or provident fund, allowances, bonus) do I receive?", severity: "low" },
  { id: "missing-termination", title: "Termination and notice not stated", pattern: /\b(?:notice period|termination|resign(?:ation)?|notice of|dismiss(?:al)?)\b/i, question: "How much notice must each side give to end the job, and are there other conditions for ending it?", severity: "medium" },
];

export function analyzeClauses(rawText: string, options: { missing?: boolean } = {}): ClauseAnalysis {
  const text = rawText.replace(/\r\n?/g, "\n");
  const findings: ClauseFinding[] = [];
  if (!text.trim()) return { findings, limitations: LIMITS };
  for (const rule of RULES) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    const place = locate(text, match);
    findings.push({ id: rule.id, kind: rule.kind, severity: rule.severity, title: rule.title, explanation: rule.explanation, question: rule.question, quote: place.quote, source: place.source });
  }
  findings.push(...contradictions(text));
  // A term is only called missing when there is enough text to judge; a one-line note says little about what a full offer omits.
  if (options.missing !== false && text.trim().length >= 120) {
    for (const expected of EXPECTED) {
      if (!expected.pattern.test(text)) findings.push({ id: expected.id, kind: "missing", severity: expected.severity, title: expected.title, explanation: "The text does not mention this term.", question: expected.question, quote: null, source: null });
    }
  }
  const order = { high: 0, medium: 1, low: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { findings, limitations: LIMITS };
}

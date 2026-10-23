import { z } from "zod";

export const OFFER_ASSESSMENT_VERSION = "offer-indicators.v1";
const itemSchema = z.strictObject({
 id: z.string(), label: z.string(), category: z.string(), points: z.number().int().min(0).max(5),
 status: z.enum(["stated", "missing", "uncertain", "concern"]), evidence: z.string().nullable(),
 explanation: z.string(), recommendation: z.string(),
});
export const assessmentSchema = z.strictObject({
 version: z.literal(OFFER_ASSESSMENT_VERSION), score: z.number().int().min(0).max(100),
 meaning: z.string(), limitations: z.string(), employerVerification: z.literal("not_assessed"),
 statedCount: z.number().int(), missingCount: z.number().int(), uncertainCount: z.number().int(), concernCount: z.number().int(),
 categories: z.array(z.strictObject({ label: z.string(), score: z.number().int().min(0).max(20), maximum: z.literal(20) })),
 items: z.array(itemSchema).length(20),
});
export const savedAssessmentSchema = z.strictObject({
 offerId: z.uuid(), offerVersion: z.number().int().positive(), termHash: z.string().regex(/^[a-f0-9]{64}$/), assessment: assessmentSchema,
});
type Item = z.infer<typeof itemSchema>;
type Criterion = { id: string; label: string; category: string; question: string; valid?: (value: string) => boolean; concern?: RegExp };
const criteria: readonly Criterion[] = [
 { id: "salary", label: "Pay amount", category: "Pay transparency", question: "Confirm one base pay amount, excluding fees and allowances.", valid: value => /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0 && Number(value) <= Number.MAX_SAFE_INTEGER },
 { id: "currency", label: "Pay currency", category: "Pay transparency", question: "State the three-letter pay currency code.", valid: value => /^(LKR|USD|EUR|GBP|AUD|CAD|NZD|INR|SGD|AED|SAR|QAR|KWD|BHD|OMR|MYR|JPY|CHF|CNY|KRW|THB|BDT|NPR|PKR|ZAR)$/.test(value) },
 { id: "payPeriod", label: "Pay period", category: "Pay transparency", question: "Confirm whether pay is hourly, daily, weekly, monthly, yearly or per project.", valid: value => /^(hourly|daily|weekly|monthly|yearly|project)$/i.test(value) },
 { id: "paymentDate", label: "Payment schedule", category: "Pay transparency", question: "State when and how often payment is due." },
 { id: "hoursPerWeek", label: "Weekly hours", category: "Working time and leave", question: "Agree one expected weekly hours figure; resolve ranges or competing figures.", valid: value => /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0 && Number(value) <= 168 },
 { id: "schedule", label: "Work schedule", category: "Working time and leave", question: "Specify working days, shifts and rest periods." },
 { id: "overtime", label: "Overtime terms", category: "Working time and leave", question: "Agree overtime approval, hours and compensation in writing.", concern: /^(?:unpaid overtime (?:is )?(?:required|mandatory)|overtime (?:is )?(?:required|mandatory) (?:and |but )?(?:unpaid|uncompensated)|no overtime pay (?:will be|is) provided)\b/i },
 { id: "leave", label: "Leave terms", category: "Working time and leave", question: "Specify leave entitlements, pay and the request process." },
 { id: "role", label: "Role title", category: "Contract clarity", question: "State the role title." },
 { id: "responsibilities", label: "Responsibilities", category: "Contract clarity", question: "Describe the duties and scope of work." },
 { id: "employmentType", label: "Employment type", category: "Contract clarity", question: "Specify the intended employment arrangement." },
 { id: "contractDuration", label: "Contract duration", category: "Contract clarity", question: "Confirm the contract duration or that it is ongoing." },
 { id: "probation", label: "Trial and probation", category: "Worker protections", question: "Agree whether there is a trial/probation, its duration and pay.", concern: /^(?:unpaid (?:trial|probation|training) (?:is )?(?:required|mandatory)|(?:trial|probation|training) (?:is )?(?:required|mandatory) (?:and |but )?unpaid)\b/i },
 { id: "notice", label: "Notice and termination", category: "Worker protections", question: "Agree notice, termination grounds and final payment arrangements." },
 { id: "safety", label: "Workplace safety", category: "Worker protections", question: "Clarify equipment, training and reporting arrangements." },
 { id: "documentRetention", label: "Original documents", category: "Worker protections", question: "Confirm whether original identity documents remain with the worker.", concern: /^(?:(?:you|workers?) must (?:surrender|hand over) (?:your |their )?(?:passport|original|identity)|(?:employer|company) (?:will|must) (?:retain|keep|hold) (?:your |the )?(?:passport|original|identity))\b/i },
 { id: "deductions", label: "Deductions", category: "Financial commitments", question: "List deductions, their amounts, reasons and authorization.", concern: /^(?:all |any )?(?:business )?losses (?:will be|are) deducted from (?:your |the )?(?:salary|pay)\b/i },
 { id: "trainingDeposit", label: "Fees and deposits", category: "Financial commitments", question: "Confirm whether any fee/deposit is required; specify purpose, recipient and refund terms.", concern: /^(?:(?:you|workers?) must pay (?:an? )?(?:upfront |training |security |equipment |registration )?(?:fee|deposit)|(?:upfront |training |security |equipment |registration )?(?:fee|deposit) (?:is )?(?:required|mandatory))\b/i },
 { id: "benefits", label: "Benefits", category: "Financial commitments", question: "List benefits and eligibility, or explicitly state that none are offered." },
 { id: "contractConditions", label: "Other obligations", category: "Financial commitments", question: "List other obligations, restrictions or liabilities, or explicitly state none." },
];
const unresolved = /\b(?:unknown|tbd|tbc|unspecified|not (?:yet )?(?:specified|stated|agreed|confirmed)|to be (?:confirmed|determined|agreed)|pending clarification)\b|^n\/?a$/i;

/** Equal-weight checklist, not a calibrated measure of fairness or legal compliance.
 * Scores only reviewed saved terms. AI output and employer claims are not inputs.
 * A zero represents an unsupported criterion, never evidence of wrongdoing.
 */
export function assessOfferTerms(terms: Readonly<Record<string, string | number>>) {
 const items: Item[] = criteria.map(rule => {
  const raw = terms[rule.id];
  const evidence = raw === undefined ? null : String(raw).trim() || null;
  let status: Item["status"] = "stated";
  if (evidence === null) status = "missing";
  else if (unresolved.test(evidence) || (rule.valid && !rule.valid(evidence))) status = "uncertain";
  // Only explicit affirmative obligations at the start of a reviewed field
  // affect points. Generic phrase matches remain unscored review suggestions.
  else if (rule.concern?.test(evidence)) status = "concern";
  return { id: rule.id, label: rule.label, category: rule.category, status, evidence,
   points: status === "stated" ? 5 : 0,
   explanation: status === "stated" ? "Reviewed field is stated; no configured explicit concern matched. This does not verify the claim or establish fairness."
    : status === "missing" ? "No reviewed evidence for this criterion. Missing information is not evidence of wrongdoing."
    : status === "uncertain" ? "This value is unresolved or outside the rule's supported format; no points awarded until clarified."
    : "The reviewed field explicitly states an obligation requiring attention. This is an advisory concern, not a finding of illegality.",
   recommendation: rule.question,
  };
 });
 const count = (status: Item["status"]) => items.filter(item => item.status === status).length;
 return assessmentSchema.parse({
  version: OFFER_ASSESSMENT_VERSION, score: items.reduce((sum,item)=>sum+item.points,0),
  meaning: "Points supported by 20 equally weighted clarity and protection checks (5 each). Higher means more reviewed terms stated without a configured explicit concern, not a safer employer or a fair market wage.",
  limitations: "Product checklist, not an empirically validated rating, legal opinion, salary benchmark or safety guarantee. Claims may be inaccurate. Rules can miss risks and contradictions. Employer legitimacy, independent verification and AI observations are excluded. No jurisdiction-specific legal thresholds are applied.",
  employerVerification: "not_assessed", statedCount: count("stated"), missingCount: count("missing"), uncertainCount: count("uncertain"), concernCount: count("concern"),
  categories: [...new Set(criteria.map(rule=>rule.category))].map(label=>({label,score:items.filter(item=>item.category===label).reduce((sum,item)=>sum+item.points,0),maximum:20})), items,
 });
}

import type { AiOfferAnalysisData } from "./ai-schema";
import { scamIndicators } from "@/features/scam/check";

/**
 * Fast, deterministic rule-based extractor for local use when no AI provider is configured.
 * Clearly labeled as rule-based; NEVER masquerades as AI.
 */
export function extractOfferTermsRuleBased(text: string): {
  data: AiOfferAnalysisData;
  detectedTerms: Record<string, string | number>;
} {
  const cleaned = text.trim();
  const detectedTerms: Record<string, string | number> = {};

  // 1. Detect salary & currency
  let amount: number | null = null;
  let currency: string | null = null;
  let period: "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "project" | "unknown" = "unknown";
  let salaryQuote: string | null = null;

  // Regex patterns for currencies and numbers (e.g., LKR 75,000, Rs. 80000, $4500, 150000 LKR)
  // Prefer explicit pay lines. Never treat a deposit, deduction or equipment
  // price as salary merely because it is the first currency amount in the text.
  const lines = cleaned.split(/[\n\r;]+|(?<=[.!?])\s+(?=[A-Z])/).map(line => line.trim()).filter(Boolean);
  const payLabel = /\b(?:salary|wage|remuneration|base pay|basic pay)\b|\bpay\s*[:–—-]/i;
  const payLines = lines.filter(line => payLabel.test(line));
  const moneyPattern = /(?:(LKR|Rs\.?|USD|\$|EUR|€|GBP|£|AUD)\s*([0-9]+(?:[,\s][0-9]{3})*(?:\.[0-9]+)?\s*[kK]?)|([0-9]+(?:[,\s][0-9]{3})*(?:\.[0-9]+)?\s*[kK]?)\s*(LKR|Rs\.?|USD|EUR|GBP|AUD))/i;
  const candidates = (payLines.length ? payLines : lines.filter(line => moneyPattern.test(line))).filter(line =>
    !/\b(?:deposit|deduction|fee|bonus|allowance|up to|between|from)\b/i.test(line) && !/\d[\d,.]*\s*(?:[-–—]|to)\s*(?:(?:LKR|USD|EUR|GBP)\s*)?\d/i.test(line));
  const candidate = candidates.length === 1 ? candidates[0] ?? "" : "";
  const salarySource = [...candidate.matchAll(new RegExp(moneyPattern.source, "gi"))].length <= 1 ? candidate : "";
  const salaryMatch = salarySource.match(moneyPattern)
    ?? salarySource.match(/\b(?:salary|wage|remuneration|pay)\s*[:–—-]?\s*()([0-9]+(?:[,\s][0-9]{3})*(?:\.[0-9]+)?\s*[kK]?)/i);

  if (salaryMatch) {
    salaryQuote = salaryMatch[0];
    const rawCurrency = salaryMatch[1] || salaryMatch[4] || "";
    const rawAmount = salaryMatch[2] || salaryMatch[3] || "";

    const num = parseFloat(rawAmount.replace(/[,\s]/g, "")) * (/k\s*$/i.test(rawAmount) ? 1000 : 1);
    if (Number.isFinite(num) && num > 0) {
      amount = num;
      detectedTerms.salary = num;
    }

    if (rawCurrency) {
      if (rawCurrency.startsWith("$") || /^Rs/i.test(rawCurrency)) currency = null;
      else if (rawCurrency.startsWith("€")) currency = "EUR";
      else if (rawCurrency.startsWith("£")) currency = "GBP";
      else currency = rawCurrency.toUpperCase();
      if (currency) detectedTerms.currency = currency;
    }
  }

  // Detect pay period
  if (/(?:per\s*month|\/\s*month|\bmonthly\b)/i.test(salarySource)) period = "monthly";
  else if (/(?:per\s*hour|\/\s*hr|\/\s*hour|\bhourly\b)/i.test(salarySource)) period = "hourly";
  else if (/(?:per\s*week|\/\s*week|\bweekly\b)/i.test(salarySource)) period = "weekly";
  else if (/(?:per\s*annum|\/\s*year|\bannual(?:ly)?\b|\byearly\b)/i.test(salarySource)) period = "yearly";
  else if (/(?:per\s*day|\/\s*day|\bdaily\b)/i.test(salarySource)) period = "daily";
  if (amount && period !== "unknown") detectedTerms.payPeriod = period;
  const taxBasis = /\bgross\b/i.test(salarySource) && !/\bnet\b/i.test(salarySource) ? "gross"
    : /\bnet\b/i.test(salarySource) && !/\bgross\b/i.test(salarySource) ? "net" : "unknown";
  if (taxBasis !== "unknown") detectedTerms.taxBasis = taxBasis;

  // 2. Detect working hours
  let hoursPerWeek: number | null = null;
  let hoursQuote: string | null = null;
  const hoursMatch = cleaned.match(/\b([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*(?:hours?|hrs?|h)\s*(?:(?:per|\/)\s*week|a\s+week|weekly)\b/i)
    ?? cleaned.match(/\b(?:weekly\s+(?:working\s+)?hours|hours\s+per\s+week)\s*[:–—-]\s*([0-9]{1,3}(?:\.[0-9]{1,2})?)\b/i);
  const hoursPrefix = hoursMatch ? cleaned.slice(0, hoursMatch.index) : "";
  const hoursSuffix = hoursMatch ? cleaned.slice((hoursMatch.index ?? 0) + hoursMatch[0].length) : "";
  if (hoursMatch && hoursMatch[1] && !/(?:\d\s*(?:[-–—]|to)|up to|between)\s*$/i.test(hoursPrefix) && !/^\s*(?:[-–—]|to)\s*\d/i.test(hoursSuffix)) {
    const parsedHours = parseFloat(hoursMatch[1]);
    if (parsedHours > 0 && parsedHours <= 168) {
      hoursPerWeek = parsedHours;
      hoursQuote = hoursMatch[0];
      detectedTerms.hoursPerWeek = parsedHours;
    }
  }
  const weeklyValues = [
    ...cleaned.matchAll(/\b([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*(?:hours?|hrs?|h)\s*(?:(?:per|\/)\s*week|a\s+week|weekly)\b/gi),
    ...cleaned.matchAll(/\b(?:weekly\s+(?:working\s+)?hours|hours\s+per\s+week)\s*[:–—-]\s*([0-9]{1,3}(?:\.[0-9]{1,2})?)\b/gi),
  ].map(match => Number(match[1]));
  if (new Set(weeklyValues).size > 1) {
    hoursPerWeek = null; hoursQuote = null; delete detectedTerms.hoursPerWeek;
  }

  // 3. Detect role title
  let roleTitle: string | null = null;
  const plain = cleaned.replace(/\*\*|__/g, "");
  const roleMatch = plain.match(/(?:position|role|job\s*title|designation)\s*[:\-–—]\s*([^\n\r,.;]+)/i)
    ?? plain.match(/\b(?:hiring|recruiting|looking for)\s+(?:an?\s+)?([^\n\r,.;]+?)(?=\s+(?:to|at|in|for|with)\b|[\n\r,.;]|$)/i)
    ?? plain.match(/\b(?:position|role)\s+(?:of|as)\s+(?:an?\s+)?([^\n\r,.;]+?)(?=\s+(?:at|in|with)\b|[\n\r,.;]|$)/i);
  if (roleMatch && roleMatch[1]?.trim()) {
    roleTitle = roleMatch[1].trim();
    if (roleTitle.length <= 120) detectedTerms.role = roleTitle;
  }

  // 4. Detect location
  let location: string | null = null;
  const locMatch = cleaned.match(/(?:location|workplace|city)\s*[:\-–]\s*([^\n\r,.;]+)/i);
  if (locMatch && locMatch[1]?.trim()) {
    location = locMatch[1].trim();
    detectedTerms.location = location;
  }

  // Copy stated conditions only. Do not infer dates, benefits or contractual
  // obligations, and never silently truncate a long clause to fit a form field.
  const labeled = (label: string, max = 500) => {
    const values = [...plain.matchAll(new RegExp(`(?:^|[\\n\\r;])\\s*(?:[-•]\\s*)?(?:${label})\\s*[:–—-]\\s*([^\\n\\r;]+)`, "gi"))].map(match=>match[1]?.trim());
    const value = new Set(values).size === 1 ? values[0] : null;
    return value && value.length <= max ? value : null;
  };
  for (const [field, label, max] of [
    ["startDate", "start date|starting date|commencement date", 80],
    ["responsibilities", "responsibilities|duties|job duties", 500],
    ["employmentType", "employment type|contract type", 500],
    ["overtime", "overtime(?: terms| pay)?", 500],
    ["paymentDate", "payment date|pay date", 500],
    ["benefits", "benefits", 500], ["probation", "probation(?: period)?", 500],
    ["notice", "notice(?: period)?|termination notice", 500],
    ["deductions", "deductions", 500],
    ["contractConditions", "contract conditions|conditions", 500],
    ["safety", "safety(?: information| equipment)?", 500],
    ["schedule", "schedule|work schedule|working days", 500],
    ["leave", "leave|leave terms|paid leave|annual leave", 500],
    ["contractDuration", "contract duration|duration", 500],
    ["documentRetention", "original document requirements|document retention|identity documents", 500],
    ["trainingDeposit", "fees and deposits|training deposit|security deposit|equipment deposit|registration fee|training fee", 500],
    ["employerName", "employer|company|employer name|company name", 500],
  ] as const) {
    const value = labeled(label, max);
    if (value) detectedTerms[field] = value;
  }
  // Keep the deposit label: copying an isolated amount into "other conditions"
  // would lose what the payment refers to. Keep distinct stated clauses together.
  const depositLines = plain.split(/[\n\r]+/).map(line => line.trim()).filter(line => /^(?:[-•]\s*)?(?:security |equipment )?deposits?\s*[:–—-]/i.test(line));
  if (depositLines.length) {
    const conditions = [detectedTerms.contractConditions, ...depositLines].filter(Boolean).join("\n");
    if (conditions.length <= 500) detectedTerms.contractConditions = conditions;
  }

  // 5. Detect warning signs with strict rules
  const warningSigns = [];
  if (/(?:unpaid\s*trial|unpaid\s*probation|work\s*for\s*free|test\s*period\s*without\s*pay)/i.test(cleaned)) {
    warningSigns.push({
      id: "unpaid-trial",
      severity: "high" as const,
      title: "Trial-pay wording to review",
      description: "A phrase concerning unpaid trial work appears. Review its context; a phrase match alone does not establish the agreed terms or legality.",
      quote: cleaned.match(/(?:unpaid\s*trial|unpaid\s*probation|work\s*for\s*free|test\s*period\s*without\s*pay)/i)![0],
      recommendation: "Ask whether any productive trial work is required and how it would be paid.",
    });
  }

  if (/(?:security\s*deposit|pay\s*an\s*upfront|training\s*fee|registration\s*fee|equipment\s*deposit)/i.test(cleaned)) {
    warningSigns.push({
      id: "upfront-fee",
      severity: "high" as const,
      title: "Fee or deposit wording to review",
      description: "Fee or deposit language appears. This rule does not determine whether a payment is required or whether the company is legitimate.",
      quote: cleaned.match(/(?:security\s*deposit|pay\s*an\s*upfront|training\s*fee|registration\s*fee|equipment\s*deposit)/i)![0],
      recommendation: "Clarify the amount, purpose, recipient and refund conditions before deciding whether to proceed.",
    });
  }

  if (/(?:hold\s*passport|keep\s*your\s*id|surrender\s*documents|retain\s*certificate)/i.test(cleaned)) {
    warningSigns.push({
      id: "document-retention",
      severity: "high" as const,
      title: "Document-retention wording to review",
      description: "Document-retention language appears. Review the surrounding wording to determine whether this is a requirement, prohibition or example.",
      quote: cleaned.match(/(?:hold\s*passport|keep\s*your\s*id|surrender\s*documents|retain\s*certificate)/i)![0],
      recommendation: "Ask whether originals must be surrendered, for how long, and whether copies are sufficient.",
    });
  }

  if (/(?:no\s*overtime\s*pay|unpaid\s*overtime|overtime\s*is\s*mandatory\s*and\s*uncompensated)/i.test(cleaned)) {
    warningSigns.push({
      id: "unpaid-overtime",
      severity: "medium" as const,
      title: "Overtime-pay wording to review",
      description: "An uncompensated-overtime phrase appears. Confirm the full context before interpreting it as an obligation.",
      quote: cleaned.match(/(?:no\s*overtime\s*pay|unpaid\s*overtime|overtime\s*is\s*mandatory\s*and\s*uncompensated)/i)![0],
      recommendation: "Request written overtime hours, approval rules and compensation terms.",
    });
  }

  // Recruiter-scam wording and email-domain indicators (module 17); wording checks only, never a verdict.
  for (const indicator of scamIndicators(cleaned)) if (warningSigns.length < 12) warningSigns.push(indicator);

  // 6. Missing details
  const missingDetails = [];
  if (!amount) {
    missingDetails.push({
      id: "salary-missing",
      field: "salary",
      importance: "critical" as const,
      explanation: "No specific salary amount was identified in the offer text.",
    });
  }
  if (!hoursPerWeek) {
    missingDetails.push({
      id: "hours-missing",
      field: "hoursPerWeek",
      importance: "critical" as const,
      explanation: "Expected weekly working hours are not specified.",
    });
  }
  if (!/(?:overtime|ot\s*rate|extra\s*hours)/i.test(cleaned)) {
    missingDetails.push({
      id: "overtime-missing",
      field: "overtime",
      importance: "important" as const,
      explanation: "Overtime compensation rate and policies are omitted.",
    });
  }
  if (!/(?:pay\s*date|payment\s*date|end\s*of\s*month|last\s*day|bi-weekly|monthly\s*on)/i.test(cleaned)) {
    missingDetails.push({
      id: "pay-date-missing",
      field: "paymentDate",
      importance: "important" as const,
      explanation: "Specific salary payment date or payment schedule is missing.",
    });
  }

  // 7. Follow-up questions
  const followUpQuestions = [
    {
      id: "q-pay-date",
      field: "paymentDate",
      question: "On which date of each month will salary be transferred or disbursed?",
      rationale: "Having an agreed payment date prevents delayed compensation.",
      importance: "important" as const,
    },
    {
      id: "q-overtime",
      field: "overtime",
      question: "If work exceeds the agreed weekly hours, what is the overtime payment rate?",
      rationale: "Ensures compensation for extra hours before commencing work.",
      importance: "critical" as const,
    },
    {
      id: "q-equipment",
      field: "safety",
      question: "Are necessary work tools, safety equipment, or uniforms provided by the company?",
      rationale: "Clarifies that equipment costs are not deducted from salary.",
      importance: "recommended" as const,
    },
  ];

  return {
    detectedTerms,
    data: {
      salary: {
        amount,
        currency,
        period,
        taxBasis,
        clarity: amount ? (currency && period !== "unknown" ? "stated" : "ambiguous") : payLines.length ? "ambiguous" : "missing",
        quote: salaryQuote,
        explanation: amount ? `Detected ${currency ?? ""} ${amount} (${period}) via rule-based pattern.` : "No clear salary figure detected in text.",
      },
      workingHours: {
        hoursPerWeek,
        schedule: String(detectedTerms.schedule ?? "") || null,
        overtimeTerms: String(detectedTerms.overtime ?? "") || null,
        clarity: hoursPerWeek ? "stated" : weeklyValues.length ? "ambiguous" : "missing",
        quote: hoursQuote,
        explanation: hoursPerWeek ? `Detected ${hoursPerWeek} hours per week.` : "No weekly hours figure detected in text.",
      },
      contractTerms: {
        roleTitle,
        employmentType: String(detectedTerms.employmentType ?? "") || null,
        location,
        startDate: String(detectedTerms.startDate ?? "") || null,
        duration: String(detectedTerms.contractDuration ?? "") || null,
        responsibilities: String(detectedTerms.responsibilities ?? "") || null,
        probationPeriod: String(detectedTerms.probation ?? "") || null,
        terminationNotice: String(detectedTerms.notice ?? "") || null,
      },
      warningSigns,
      missingDetails,
      followUpQuestions,
      companyClaimNotice: "Notice: Rule-based heuristics cannot verify company registration, employer authority, or legal validity.",
    },
  };
}

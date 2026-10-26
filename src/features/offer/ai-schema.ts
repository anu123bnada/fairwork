import { z } from "zod";

export const offerRoleInputSchema = z.enum(["EMPLOYER", "WORKER"]);

export const analyzeOfferInputSchema = z.strictObject({
  text: z.string().trim().min(10, "Offer text must contain at least 10 characters").max(10000, "Offer text exceeds maximum length of 10,000 characters"),
  role: offerRoleInputSchema.default("WORKER"),
  consent: z.strictObject({
    provider: z.enum(["openai", "gemini", "selfhosted"]), noticeVersion: z.literal("offer-analysis.v1"), transmit: z.literal(true), policyHash: z.string().regex(/^[0-9a-f]{64}$/),
    // Optional fallbacks the person also accepts, each bound to that provider's own policy hash. Text goes to a fallback only if it is named here.
    fallbacks: z.array(z.strictObject({ provider: z.enum(["openai", "gemini", "selfhosted"]), policyHash: z.string().regex(/^[0-9a-f]{64}$/) })).max(2).optional(),
  }).optional(),
});

export type AnalyzeOfferInput = z.infer<typeof analyzeOfferInputSchema>;

export const warningSignSchema = z.strictObject({
  id: z.string().min(1).max(80),
  severity: z.enum(["high", "medium", "low"]),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  quote: z.string().max(1500).nullable(),
  recommendation: z.string().min(1).max(500),
});

export type WarningSign = z.infer<typeof warningSignSchema>;

export const missingDetailSchema = z.strictObject({
  id: z.string().min(1).max(80),
  field: z.string().min(1).max(80),
  importance: z.enum(["critical", "important", "recommended"]),
  explanation: z.string().min(1).max(500),
});

export type MissingDetail = z.infer<typeof missingDetailSchema>;

export const followUpQuestionSchema = z.strictObject({
  id: z.string().min(1).max(80),
  field: z.string().min(1).max(80),
  question: z.string().min(1).max(300),
  rationale: z.string().min(1).max(500),
  importance: z.enum(["critical", "important", "recommended"]),
});

export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;

export const extractedSalarySchema = z.strictObject({
  amount: z.number().finite().positive().nullable(),
  currency: z.string().max(10).nullable(),
  period: z.enum(["hourly", "daily", "weekly", "monthly", "yearly", "project", "unknown"]),
  taxBasis: z.enum(["gross", "net", "unknown"]),
  clarity: z.enum(["stated", "ambiguous", "missing"]),
  quote: z.string().max(1500).nullable(),
  explanation: z.string().max(1000),
});

export const extractedHoursSchema = z.strictObject({
  hoursPerWeek: z.number().finite().positive().nullable(),
  schedule: z.string().nullable(),
  overtimeTerms: z.string().nullable(),
  clarity: z.enum(["stated", "ambiguous", "missing"]),
  quote: z.string().max(1500).nullable(),
  explanation: z.string().max(1000),
});

export const extractedContractTermsSchema = z.strictObject({
  roleTitle: z.string().nullable(),
  employmentType: z.string().nullable(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  duration: z.string().nullable(),
  responsibilities: z.string().nullable(),
  probationPeriod: z.string().nullable(),
  terminationNotice: z.string().nullable(),
});

export const aiOfferAnalysisDataSchema = z.strictObject({
  salary: extractedSalarySchema,
  workingHours: extractedHoursSchema,
  contractTerms: extractedContractTermsSchema,
  warningSigns: z.array(warningSignSchema).max(12),
  missingDetails: z.array(missingDetailSchema).max(20),
  followUpQuestions: z.array(followUpQuestionSchema).max(12),
  companyClaimNotice: z.string().max(1000),
});

export type AiOfferAnalysisData = z.infer<typeof aiOfferAnalysisDataSchema>;

export const aiOfferAnalysisResponseSchema = z.strictObject({
  configured: z.boolean(),
  provider: z.enum(["gemini", "openai", "selfhosted", "none"]).nullable(),
  status: z.enum(["SUCCESS", "UNCONFIGURED", "RATE_LIMITED", "ERROR"]),
  message: z.string(),
  isAdvisory: z.literal(true),
  extractedAt: z.string(),
  data: aiOfferAnalysisDataSchema.nullable(),
  // Present when a provider asked for a pause or the gateway paused it, and when several providers were tried.
  retryAfterSeconds: z.number().int().nonnegative().optional(),
  attempts: z.array(z.strictObject({ provider: z.enum(["gemini", "openai", "selfhosted"]), outcome: z.string().max(24) })).max(4).optional(),
});

export type AiOfferAnalysisResponse = z.infer<typeof aiOfferAnalysisResponseSchema>;

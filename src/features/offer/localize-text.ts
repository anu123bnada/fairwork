import type { MessageKey } from "@/i18n";
import type { z } from "zod";
import type { assessmentSchema } from "./assessment";

// The rule engines produce fixed English wording per criterion, status and rule id. Presentation looks that wording up in the language
// catalog by id, so stored results stay language-neutral and a language is only a view. Anything without a catalog entry (for example a
// message that quotes a specific domain) is shown exactly as the engine wrote it, never guessed. A unit test pins the English catalog
// to the engine text, so the two cannot drift apart.
type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
type Assessment = z.infer<typeof assessmentSchema>;

export const CRITERIA = ["salary", "currency", "payPeriod", "paymentDate", "hoursPerWeek", "schedule", "overtime", "leave", "role", "responsibilities", "employmentType", "contractDuration", "probation", "notice", "safety", "documentRetention", "deductions", "trainingDeposit", "benefits", "contractConditions"] as const;
const CATEGORY: Record<string, MessageKey> = {
  "Pay transparency": "as.cat.pay", "Working time and leave": "as.cat.time", "Contract clarity": "as.cat.contract",
  "Worker protections": "as.cat.protect", "Financial commitments": "as.cat.finance",
};
export const WARNING_IDS = ["unpaid-trial", "upfront-fee", "document-retention", "unpaid-overtime", "scam-gift-card-crypto", "scam-pay-to-start", "scam-guaranteed-abroad", "scam-off-platform-chat", "scam-sensitive-data-early", "scam-urgency", "scam-unrealistic-pay", "scam-free-mail-company"] as const;
export const QUESTION_IDS = ["q-pay-date", "q-overtime", "q-equipment"] as const;
const has = (list: readonly string[], id: string) => list.includes(id);

export function localizeAssessment(assessment: Assessment, t: T): Assessment {
  return {
    ...assessment,
    meaning: t("as.meaning"), limitations: t("as.limitations"),
    categories: assessment.categories.map(category => ({ ...category, label: CATEGORY[category.label] ? t(CATEGORY[category.label]!) : category.label })),
    items: assessment.items.map(item => has(CRITERIA, item.id) ? {
      ...item,
      label: t(`as.i.${item.id}.l` as MessageKey), category: CATEGORY[item.category] ? t(CATEGORY[item.category]!) : item.category,
      explanation: t(`as.ex.${item.status}` as MessageKey), recommendation: t(`as.i.${item.id}.q` as MessageKey),
    } : item),
  };
}
export const statusLabel = (status: Assessment["items"][number]["status"], t: T) => t(`as.st.${status}` as MessageKey);

type Sign = { id: string; title: string; description: string; recommendation: string };
export function localizeWarning<S extends Sign>(sign: S, t: T): S {
  if (!has(WARNING_IDS, sign.id)) return sign;
  return { ...sign, title: t(`ra.w.${sign.id}.t` as MessageKey), description: t(`ra.w.${sign.id}.d` as MessageKey), recommendation: t(`ra.w.${sign.id}.r` as MessageKey) };
}
export function localizeQuestion<Q extends { id: string; question: string }>(question: Q, t: T): Q {
  return has(QUESTION_IDS, question.id) ? { ...question, question: t(`ra.q.${question.id}` as MessageKey) } : question;
}

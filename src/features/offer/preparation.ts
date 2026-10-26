import { assessOfferTerms } from "./assessment";
import type { MessageKey } from "@/i18n";

// Interview and negotiation preparation (module 11), built only from the offer's own checklist. It is fixed-rule guidance: it does not call a model, does not
// know how the employer will answer, and is not legal advice. A point that is stated in the offer produces no question.
const RANK = { concern: 0, uncertain: 1, missing: 2 } as const;
export const interviewKeys = ["prep.iv.research", "prep.iv.story", "prep.iv.documents", "prep.iv.noFees", "prep.iv.ask"] as const satisfies readonly MessageKey[];

export function negotiationQuestionKeys(terms: Readonly<Record<string, string | number>>): MessageKey[] {
  return assessOfferTerms(terms).items
    .filter(item => item.status !== "stated")
    .sort((a, b) => RANK[a.status as keyof typeof RANK] - RANK[b.status as keyof typeof RANK])
    .map(item => `prep.q.${item.id}` as MessageKey);
}

import { assessOfferTerms } from "./assessment";
import { localizeAssessment, statusLabel } from "./localize-text";
import type { MessageKey } from "@/i18n";

// A plain-text summary of one saved offer revision for the person's own records (module 04). It is built in the browser from what the person
// can already see: the saved terms, open questions and the local checklist. It is not a signed document, an agreement or a verification.
type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
export type SummaryInput = { employerLine?: string; version: number; termHash: string; snapshot: Record<string, unknown>; unresolved: { field: string; question: string }[]; generatedAt: Date };

export function buildOfferSummary(input: SummaryInput, t: T, fieldLabel: (field: string) => string): string {
  const terms = Object.fromEntries(Object.entries(input.snapshot).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, String(value)]));
  const assessment = localizeAssessment(assessOfferTerms(terms), t);
  const lines: string[] = [];
  lines.push(`# ${t("sum.title")}`, "", t("sum.generated", { date: input.generatedAt.toISOString().slice(0, 10), version: input.version }), "");
  if (input.employerLine) lines.push(input.employerLine, "");
  lines.push(`## ${t("sum.terms")}`, "");
  const entries = Object.entries(terms);
  if (!entries.length) lines.push(t("sum.noTerms"));
  for (const [field, value] of entries) lines.push(`- ${fieldLabel(field)}: ${value.replace(/\s+/g, " ").trim()}`);
  lines.push("", `## ${t("sum.open")}`, "");
  if (!input.unresolved.length) lines.push(t("sum.noOpen"));
  for (const item of input.unresolved) lines.push(`- ${fieldLabel(item.field)}: ${item.question}`);
  lines.push("", `## ${t("sum.checklist")}`, "", `${assessment.score}/100 — ${assessment.meaning}`, "");
  for (const item of assessment.items) lines.push(`- ${item.label}: ${statusLabel(item.status, t)} (${item.points}/5)${item.status === "stated" ? "" : ` — ${item.recommendation}`}`);
  lines.push("", `## ${t("sum.limits")}`, "", assessment.limitations, t("sum.notAgreement"), "", `${t("sum.integrity")}: ${input.termHash}`);
  return lines.join("\n");
}

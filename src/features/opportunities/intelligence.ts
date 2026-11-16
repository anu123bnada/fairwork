import type { CareerProfileContent, OpportunityFeedbackContent } from "@/features/records/schema";
import { referenceCareers } from "@/features/careers/reference";
import { explainMatch, type MatchReason } from "./matching";
import type { Opportunity, Preferences } from "./schema";

// Transparent, rule-based matching of REAL listings (employer postings stored in ORYQEN) against the person's own profile. No AI, no hidden weights, no prediction of hiring.
// Each criterion is shown with its outcome; the headline is simply "criteria met: n of m", every criterion counting equally. A listing with no checkable criteria says so.
const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const mentions = (text: string, term: string) => { const t = norm(term); return t.length >= 2 && new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(text); };
const QUALIFICATION_WORDS = ["licence", "license", "certificate", "certified", "certification", "degree", "diploma", "registration", "registered"];

export type Criterion = { id: string; label: string; outcome: "met" | "not_met" | "unknown"; detail: string };
export type MatchResult = {
  criteria: Criterion[]; met: number; checked: number;
  matchingSkills: string[]; missingRequirements: string[]; eligibilityConcerns: string[]; why: string; preferenceReasons: MatchReason[];
};

/** Skills a listing seems to ask for: the names in the reference framework plus the person's own skills, found as whole words in the title and description. Text matching only. */
export function requiredSkillsMentioned(listingText: string): string[] {
  const text = norm(listingText);
  const names = new Set(referenceCareers.flatMap(career => career.skills.map(skill => skill.name)));
  return [...names].filter(name => mentions(text, name));
}

export function matchListing(item: Opportunity, profile: CareerProfileContent | null, preferences: Preferences | null): MatchResult {
  const text = `${item.fields.title}\n${item.fields.description}`;
  const mine = (profile?.skills ?? []).map(skill => skill.name);
  const requested = requiredSkillsMentioned(text);
  const matchingSkills = [...new Set([...requested, ...mine].filter(name => mentions(norm(text), name) && mine.some(own => norm(own) === norm(name))))];
  const missingRequirements = requested.filter(name => !mine.some(own => norm(own) === norm(name)));
  const criteria: Criterion[] = [];
  const goal = profile?.primaryGoal.title?.trim() ?? "";
  if (goal) {
    const words = norm(goal).split(" ").filter(word => word.length > 3);
    const hit = words.length > 0 && words.some(word => mentions(norm(item.fields.title), word));
    criteria.push({ id: "goal", label: "Career goal", outcome: hit ? "met" : "not_met", detail: hit ? `The listing title shares words with your goal "${goal}". Text match only.` : `The listing title does not share words with your goal "${goal}". It may still be relevant.` });
  }
  if (requested.length > 0) criteria.push({ id: "skills", label: "Skills the listing mentions", outcome: missingRequirements.length === 0 ? "met" : "not_met", detail: missingRequirements.length === 0 ? `You have listed every skill the listing mentions (${matchingSkills.join(", ")}).` : `The listing mentions ${requested.join(", ")}. You have not listed: ${missingRequirements.join(", ")}.` });
  for (const reason of explainMatch(item, preferences)) criteria.push({ id: reason.id, label: reason.criterion, outcome: reason.outcome === "matches" ? "met" : reason.outcome === "differs" ? "not_met" : "unknown", detail: reason.detail });
  const checked = criteria.filter(criterion => criterion.outcome !== "unknown").length;
  const met = criteria.filter(criterion => criterion.outcome === "met").length;
  const lower = norm(text);
  const eligibilityConcerns = QUALIFICATION_WORDS.filter(word => mentions(lower, word)).length > 0 && (profile?.qualifications.length ?? 0) === 0
    ? ["The listing mentions a licence, certificate or degree and your profile lists no qualifications. Read the listing carefully and confirm what is required before applying."] : [];
  const why = checked === 0
    ? "There is nothing to compare yet. Add a career goal, skills and job preferences, and ORYQEN will explain how this listing fits."
    : `${met} of ${checked} checkable criteria are met. Each criterion counts equally and this is not a prediction of whether you would be hired or eligible.`;
  return { criteria, met, checked, matchingSkills, missingRequirements, eligibilityConcerns, why, preferenceReasons: explainMatch(item, preferences) };
}

export type FeedbackAction = OpportunityFeedbackContent["entries"][number]["action"];
export const HIDING_ACTIONS: readonly FeedbackAction[] = ["hide", "dislike", "not_relevant"];
/** The latest action per listing. One listing has at most one stored action, so a new choice replaces the old one. */
export function latestFeedback(feedback: OpportunityFeedbackContent): Map<string, FeedbackAction> {
  return new Map(feedback.entries.map(entry => [entry.listingId, entry.action]));
}
export function setFeedback(feedback: OpportunityFeedbackContent, listingId: string, action: FeedbackAction | null, at: string): OpportunityFeedbackContent {
  const rest = feedback.entries.filter(entry => entry.listingId !== listingId);
  const entries = action === null ? rest : [...rest, { listingId, action, at }];
  return { entries: entries.slice(-200) };
}

export type Ranked = { item: Opportunity; match: MatchResult; feedback: FeedbackAction | null };
/** Rank by share of checkable criteria met, then liked before neutral, then the more recently updated listing. Disliked, hidden and not-relevant listings are returned separately, never silently dropped. */
export function rankListings(items: readonly Opportunity[], profile: CareerProfileContent | null, preferences: Preferences | null, feedback: OpportunityFeedbackContent) {
  const actions = latestFeedback(feedback);
  const all: Ranked[] = items.map(item => ({ item, match: matchListing(item, profile, preferences), feedback: actions.get(item.id) ?? null }));
  const share = (ranked: Ranked) => ranked.match.checked === 0 ? 0 : ranked.match.met / ranked.match.checked;
  const shown = all.filter(ranked => !ranked.feedback || !HIDING_ACTIONS.includes(ranked.feedback))
    .sort((a, b) => share(b) - share(a) || Number(b.feedback === "like") - Number(a.feedback === "like") || b.item.updatedAt.localeCompare(a.item.updatedAt));
  return { shown, hidden: all.filter(ranked => ranked.feedback && HIDING_ACTIONS.includes(ranked.feedback)) };
}

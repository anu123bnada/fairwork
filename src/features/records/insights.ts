import type { RecordSummary } from "./schema";

// Follow-up suggestions and outcome counts computed ONLY from the person's own application records. Fixed rules, no AI, no benchmarks: the numbers describe their own list.
export const FOLLOW_UP_AFTER_DAYS = 7;
const closed = new Set(["accepted", "rejected", "withdrawn"]);
const dayNumber = (value: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value); return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000) : null; };

export type FollowUp = { id: string; title: string; reason: "overdue_next_step" | "no_reply"; days: number };
export type Insights = {
  counts: Record<string, number>; total: number; applied: number; reachedInterview: number; offers: number; rejected: number;
  followUps: FollowUp[];
};

export function computeInsights(items: readonly RecordSummary[], today: string): Insights {
  const now = dayNumber(today) ?? 0;
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  // "applied" means every application that got past the saved stage, so the share below compares like with like.
  const applied = items.filter(item => item.status !== "saved").length;
  const followUps: FollowUp[] = [];
  for (const item of items) {
    if (closed.has(item.status) || item.status === "saved") continue;
    const next = item.summary.nextStepAt ? dayNumber(item.summary.nextStepAt) : null;
    if (next !== null && next < now) { followUps.push({ id: item.id, title: item.title, reason: "overdue_next_step", days: now - next }); continue; }
    const appliedOn = item.summary.appliedOn ? dayNumber(item.summary.appliedOn) : null;
    if (item.status === "applied" && appliedOn !== null && now - appliedOn >= FOLLOW_UP_AFTER_DAYS && item.summary.eventCount === 0 && next === null) followUps.push({ id: item.id, title: item.title, reason: "no_reply", days: now - appliedOn });
  }
  followUps.sort((a, b) => b.days - a.days || a.title.localeCompare(b.title));
  return {
    counts, total: items.length, applied,
    reachedInterview: items.filter(item => item.status === "interviewing" || item.status === "offered" || item.status === "accepted").length,
    offers: items.filter(item => item.status === "offered" || item.status === "accepted").length,
    rejected: items.filter(item => item.status === "rejected").length,
    followUps,
  };
}

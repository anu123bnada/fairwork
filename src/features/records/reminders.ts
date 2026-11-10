import { computeInsights } from "./insights";
import type { RecordSummary } from "./schema";

// Reminders derived only from the person's own application records (next-step dates and the follow-up rules). Nothing is sent anywhere and nobody is contacted; the list is recomputed
// each time it is shown, so it can never be out of step with the tracker.
export type Reminder = { id: string; title: string; kind: "today" | "soon" | "overdue_next_step" | "no_reply"; days: number; at: string };
export const SOON_DAYS = 3;
const closed = new Set(["accepted", "rejected", "withdrawn", "saved"]);
const dayNumber = (value: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value); return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000) : null; };

export function scheduleReminders(items: readonly RecordSummary[], today: string): Reminder[] {
  const now = dayNumber(today) ?? 0;
  const out: Reminder[] = [];
  for (const item of items) {
    if (closed.has(item.status) || !item.summary.nextStepAt) continue;
    const at = dayNumber(item.summary.nextStepAt);
    if (at === null || at < now || at - now > SOON_DAYS) continue;
    out.push({ id: item.id, title: item.title, kind: at === now ? "today" : "soon", days: at - now, at: item.summary.nextStepAt });
  }
  for (const follow of computeInsights(items, today).followUps) out.push({ id: follow.id, title: follow.title, kind: follow.reason, days: follow.days, at: "" });
  const rank = { overdue_next_step: 0, today: 1, soon: 2, no_reply: 3 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || (a.kind === "soon" ? a.days - b.days : b.days - a.days) || a.title.localeCompare(b.title));
}

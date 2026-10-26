// Employment timeline (module 20): one chronological view over what the person already has. Nothing is created or verified here; each entry keeps the
// provenance of its source, so a self-reported job is never presented as verified and a work record keeps the state its reviewers gave it.
export type TimelineSelfReported = { id: string; content: { employer: string; role: string; startDate: string; endDate: string | null; current: boolean } };
export type TimelineWork = { workId: string; state: string; hours: string; periodStart: string; periodEnd: string };
export type TimelineEntry =
  | { kind: "self_reported"; id: string; start: string; end: string | null; employer: string; role: string }
  | { kind: "work_record"; id: string; start: string; end: string; state: string; hours: string };

// Months ("2026-03") and days ("2026-03-14") both sort correctly as text once month values are padded to the first of the month.
const sortKey = (value: string) => (value.length === 7 ? `${value}-01` : value);

export function buildTimeline(history: readonly TimelineSelfReported[], work: readonly TimelineWork[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...history.map((item): TimelineEntry => ({ kind: "self_reported", id: item.id, start: item.content.startDate, end: item.content.current ? null : item.content.endDate, employer: item.content.employer, role: item.content.role })),
    ...work.map((item): TimelineEntry => ({ kind: "work_record", id: item.workId, start: item.periodStart, end: item.periodEnd, state: item.state, hours: item.hours })),
  ];
  // Newest start first; a current job (no end) sorts ahead of a finished one that began the same day. Ties fall back to the id so the order is stable.
  return entries.sort((a, b) => sortKey(b.start).localeCompare(sortKey(a.start)) || Number(b.end === null) - Number(a.end === null) || a.id.localeCompare(b.id));
}

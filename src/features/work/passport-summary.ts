import type { Passport } from "./passport-schema";

type Entry = Passport["entries"][number];
export type PassportSummary = {
  records: number;
  hours: number;
  employers: number;
  evidenceStatements: number;
  earliest: string | null;
  latest: string | null;
};
export type PassportYearGroup = { year: string; entries: Entry[] };

// Everything here is arithmetic over rows the Passport API already returned as independently
// verified. Nothing is inferred, ranked or scored. Unparseable hour strings add nothing rather than guess.
export function summarizePassport(entries: Entry[]): PassportSummary {
  const hours = entries.reduce((sum, entry) => { const value = Number(entry.hours); return Number.isFinite(value) && value > 0 ? sum + value : sum; }, 0);
  const starts = entries.map(entry => entry.periodStart).sort();
  const ends = entries.map(entry => entry.periodEnd).sort();
  return {
    records: entries.length,
    hours: Math.round(hours * 100) / 100,
    employers: new Set(entries.map(entry => entry.companyId)).size,
    evidenceStatements: entries.reduce((sum, entry) => sum + entry.evidenceCount, 0),
    earliest: starts[0] ?? null,
    latest: ends[ends.length - 1] ?? null,
  };
}

// Newest period first, grouped by the year the period ended.
export function groupPassportByYear(entries: Entry[]): PassportYearGroup[] {
  const sorted = [...entries].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.periodStart.localeCompare(a.periodStart));
  const groups: PassportYearGroup[] = [];
  for (const entry of sorted) {
    const year = entry.periodEnd.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last?.year === year) last.entries.push(entry); else groups.push({ year, entries: [entry] });
  }
  return groups;
}

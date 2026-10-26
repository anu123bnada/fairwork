// Side-by-side comparison of two versions of an agreement's terms (module 05). It compares only what the two versions record; an open question (null) is
// different from a value, and a field present in one version only is reported as added or removed, never silently skipped.
export type TermValue = string | number | null;
export type TermChange = "same" | "changed" | "added" | "removed";
export type TermDiffRow = { field: string; before: TermValue | undefined; after: TermValue | undefined; change: TermChange };

export function diffTerms(before: Readonly<Record<string, TermValue>>, after: Readonly<Record<string, TermValue>>): TermDiffRow[] {
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return fields.map(field => {
    const hadBefore = Object.hasOwn(before, field), hadAfter = Object.hasOwn(after, field);
    const left = hadBefore ? before[field] : undefined, right = hadAfter ? after[field] : undefined;
    const change: TermChange = !hadBefore ? "added" : !hadAfter ? "removed" : String(left) === String(right) && (left === null) === (right === null) ? "same" : "changed";
    return { field, before: left, after: right, change };
  });
}
export const changedTerms = (rows: readonly TermDiffRow[]) => rows.filter(row => row.change !== "same");

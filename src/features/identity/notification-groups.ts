// Groups notifications into "today" and "earlier" by the viewer's local calendar day, keeping the given order.
export function groupByDay<T extends { recordedAt: string }>(items: T[], now: Date): { key: "today" | "earlier"; items: T[] }[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const today = items.filter(item => Date.parse(item.recordedAt) >= start);
  const earlier = items.filter(item => !(Date.parse(item.recordedAt) >= start));
  return [...(today.length ? [{ key: "today" as const, items: today }] : []), ...(earlier.length ? [{ key: "earlier" as const, items: earlier }] : [])];
}

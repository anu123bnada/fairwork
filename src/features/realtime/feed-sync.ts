// Client-side reconciliation for a feed that can be refreshed by more than one path (a fetch on load, a refresh on focus, a retry after a failure, and in future a
// push signal). It is deliberately transport-agnostic: nothing here is Realtime, and nothing may present a refetch as live push. What it guarantees:
//  - duplicates never appear (an item is identified by its eventKey),
//  - a read item never becomes unread again because an older copy arrived late,
//  - the newest items come first and the list stays bounded,
//  - after a gap (offline, sleeping tab, dropped connection) the caller is told to refetch from the server instead of trusting the events it happened to receive.
export type FeedItem = { eventKey: string; recordedAt: string; read: boolean };

export function mergeFeed<T extends FeedItem>(current: readonly T[], incoming: readonly T[], limit = 100): T[] {
  const byKey = new Map<string, T>();
  for (const item of [...current, ...incoming]) {
    const known = byKey.get(item.eventKey);
    if (!known) { byKey.set(item.eventKey, item); continue; }
    const newer = Date.parse(item.recordedAt) >= Date.parse(known.recordedAt) ? item : known;
    byKey.set(item.eventKey, { ...newer, read: known.read || item.read });
  }
  return [...byKey.values()].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || (a.eventKey < b.eventKey ? 1 : -1)).slice(0, Math.max(1, limit));
}

// A signal that something changed (or the connection came back) is only a hint to refetch; it carries no data the client may show.
export function needsFullRefresh(input: { lastSyncedAt: number | null; now: number; maxGapMs?: number; reconnected?: boolean; failedLastFetch?: boolean }): boolean {
  if (input.lastSyncedAt === null || input.reconnected || input.failedLastFetch) return true;
  return input.now - input.lastSyncedAt > (input.maxGapMs ?? 60_000);
}

// Exponential backoff with full jitter, capped. `random` is injectable for tests.
export function retryDelayMs(attempt: number, options: { baseMs?: number; maxMs?: number; random?: () => number } = {}): number {
  const base = options.baseMs ?? 1000, max = options.maxMs ?? 30_000, random = options.random ?? Math.random;
  const ceiling = Math.min(max, base * 2 ** Math.max(0, Math.min(attempt, 20)));
  return Math.floor(random() * ceiling);
}

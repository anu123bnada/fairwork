import { describe, expect, it } from "vitest";
import { mergeFeed, needsFullRefresh, retryDelayMs, type FeedItem } from "@/features/realtime/feed-sync";

const item = (key: string, at: string, read = false): FeedItem => ({ eventKey: key, recordedAt: at, read });
describe("feed reconciliation", () => {
  it("drops duplicates, orders newest first and keeps the list bounded", () => {
    const merged = mergeFeed([item("a", "2026-10-29T01:00:00Z"), item("b", "2026-10-29T02:00:00Z")], [item("b", "2026-10-29T02:00:00Z"), item("c", "2026-10-29T03:00:00Z")]);
    expect(merged.map(i => i.eventKey)).toEqual(["c", "b", "a"]);
    expect(mergeFeed(merged, [], 2).map(i => i.eventKey)).toEqual(["c", "b"]);
  });
  it("never turns a read item back into an unread one when an older copy arrives late", () => {
    const merged = mergeFeed([item("a", "2026-10-29T01:00:00Z", true)], [item("a", "2026-10-29T01:00:00Z", false)]);
    expect(merged).toEqual([item("a", "2026-10-29T01:00:00Z", true)]);
    expect(mergeFeed([item("a", "2026-10-29T01:00:00Z", false)], [item("a", "2026-10-29T01:00:00Z", true)])[0]!.read).toBe(true);
  });
  it("is stable when the same batch is applied twice", () => {
    const batch = [item("x", "2026-10-29T05:00:00Z"), item("y", "2026-10-29T04:00:00Z")];
    expect(mergeFeed(mergeFeed([], batch), batch)).toEqual(mergeFeed([], batch));
  });
});
describe("missed updates and reconnection", () => {
  it("asks for a full refetch on first load, after a reconnect, after a failed fetch and after a long gap, but not on a fresh sync", () => {
    expect(needsFullRefresh({ lastSyncedAt: null, now: 1000 })).toBe(true);
    expect(needsFullRefresh({ lastSyncedAt: 900, now: 1000, reconnected: true })).toBe(true);
    expect(needsFullRefresh({ lastSyncedAt: 900, now: 1000, failedLastFetch: true })).toBe(true);
    expect(needsFullRefresh({ lastSyncedAt: 0, now: 61_000 })).toBe(true);
    expect(needsFullRefresh({ lastSyncedAt: 1000, now: 20_000 })).toBe(false);
  });
  it("backs off exponentially with jitter and never exceeds the cap", () => {
    expect(retryDelayMs(0, { random: () => 0.999 })).toBeLessThan(1000);
    expect(retryDelayMs(3, { random: () => 0.999 })).toBeLessThan(8000);
    expect(retryDelayMs(3, { random: () => 0.999 })).toBeGreaterThanOrEqual(7000);
    expect(retryDelayMs(50, { random: () => 0.999 })).toBeLessThan(30_000);
    expect(retryDelayMs(5, { random: () => 0 })).toBe(0);
  });
});

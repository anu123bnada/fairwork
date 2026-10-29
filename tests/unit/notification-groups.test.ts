import { describe, expect, it } from "vitest";
import { groupByDay } from "@/features/identity/notification-groups";

describe("notification groups", () => {
  it("splits today from earlier and omits empty groups", () => {
    const now = new Date(2026, 9, 29, 15, 0, 0);
    const items = [{ recordedAt: new Date(2026, 9, 29, 9).toISOString() }, { recordedAt: new Date(2026, 9, 28, 23).toISOString() }];
    expect(groupByDay(items, now).map(g => [g.key, g.items.length])).toEqual([["today", 1], ["earlier", 1]]);
    expect(groupByDay([], now)).toEqual([]);
    expect(groupByDay([items[1]!], now).map(g => g.key)).toEqual(["earlier"]);
  });
});

import { describe, expect, it } from "vitest";
import { expiringAgreements } from "@/components/fairwork/reminders";

const DAY = 86_400_000, now = Date.parse("2026-10-28T10:00:00Z");
const item = (days: number, expired = false) => ({ expiresAt: new Date(now + days * DAY).toISOString(), expired });
describe("agreement expiry reminders", () => {
  it("lists expired proposals and those ending within a week, soonest first, and nothing else", () => {
    const list = expiringAgreements([item(30), item(5), item(-2, true), item(1)], now);
    expect(list.map(entry => entry.expired ? "expired" : entry.daysLeft)).toEqual(["expired", 1, 5]);
  });
  it("shows nothing for proposals that end later, and rounds a partial day up to one", () => {
    expect(expiringAgreements([item(8), item(40)], now)).toEqual([]);
    expect(expiringAgreements([{ expiresAt: new Date(now + 3_600_000).toISOString(), expired: false }], now)[0]!.daysLeft).toBe(1);
  });
});

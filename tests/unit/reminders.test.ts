import { describe, expect, it } from "vitest";
import { expiringCredentials } from "@/components/fairwork/reminders";

const NOW = Date.parse("2026-10-27T12:00:00Z");
const at = (days: number) => new Date(NOW + days * 86_400_000).toISOString();
const item = (id: string, status: string, expiresAt: string) => ({ credentialId: id, status, expiresAt });

describe("credential expiry reminders", () => {
  it("lists only valid credentials ending within 14 days, soonest first, never fewer than one day", () => {
    const result = expiringCredentials([
      item("later", "valid", at(10)), item("soon", "valid", at(2)), item("hours", "valid", at(0.2)), item("far", "valid", at(15)), item("edge", "valid", at(14)),
      item("revoked", "revoked", at(3)), item("expired", "expired", at(-1)), item("past", "valid", at(-0.5)), item("unknown", "unknown", at(3)),
    ], NOW);
    expect(result.map(entry => entry.credentialId)).toEqual(["hours", "soon", "later", "edge"]);
    expect(result.map(entry => entry.daysLeft)).toEqual([1, 2, 10, 14]);
  });
  it("is empty for nothing, bad dates and a custom window", () => {
    expect(expiringCredentials([], NOW)).toEqual([]);
    expect(expiringCredentials([item("bad", "valid", "not a date")], NOW)).toEqual([]);
    expect(expiringCredentials([item("a", "valid", at(20))], NOW, 30)).toHaveLength(1);
  });
});

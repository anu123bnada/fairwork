import { describe, it, expect } from "vitest";
import { explainMatch } from "../../src/features/opportunities/matching";
import { opportunityCommand, opportunityQuery, defaultPreferences, type Opportunity } from "../../src/features/opportunities/schema";
const item = { fields: { title: "Warehouse assistant", description: "A submitted description", location: "Colombo", workMode: "onsite", salary: 50000, currency: "LKR", payPeriod: "month" } } as Opportunity;
describe("transparent opportunity matching", () => {
  it("makes no matching claims without voluntary preferences", () => { expect(explainMatch(item, null)).toEqual([]); expect(explainMatch(item, defaultPreferences)).toEqual([]); });
  it("explains each exact criterion without an opaque score", () => {
    expect(explainMatch(item, { ...defaultPreferences, role: "warehouse", location: "Kandy", workMode: "remote", minimumPay: 40000 }).map(reason => reason.outcome)).toEqual(["matches", "differs", "differs", "matches"]);
  });
  it("does not equate different currencies, periods or missing salary", () => {
    for (const fields of [{ ...item.fields, currency: "USD" }, { ...item.fields, payPeriod: "hour" as const }, { ...item.fields, salary: null }]) expect(explainMatch({ ...item, fields }, { ...defaultPreferences, minimumPay: 40000 })[0]?.outcome).toBe("unknown");
  });
  it("rejects sensitive preference attributes and arbitrary navigation", () => {
    expect(opportunityCommand.safeParse({ operation: "preferences", preferences: { ...defaultPreferences, ethnicity: "x" }, expectedVersion: 0, idempotencyKey: crypto.randomUUID() }).success).toBe(false);
    expect(opportunityQuery.safeParse({ view: "all", actorId: "other" }).success).toBe(false);
  });
});

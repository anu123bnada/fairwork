import { describe, expect, it } from "vitest";
import { COMPARE_MAX, compareListings, payComparable } from "@/features/opportunities/compare";
import type { Opportunity } from "@/features/opportunities/schema";

const listing = (id: string, over: Partial<Opportunity["fields"]> = {}, company: string | null = "Synthetic Works"): Opportunity => ({
  id, companyId: "40000000-0000-4000-8000-000000000001", companyName: company, version: 1, status: "published", expiresAt: "2026-12-31T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
  fields: { title: `Role ${id}`, description: "A synthetic listing description", location: "Colombo", workMode: "onsite", salary: 90000, currency: "LKR", payPeriod: "month", ...over },
} as unknown as Opportunity);
const fmtPay = (pay: { amount: number; currency: string; period: string }) => `${pay.amount} ${pay.currency}/${pay.period}`;
const fmtDate = (iso: string) => iso.slice(0, 10);

describe("saved listing comparison", () => {
  it("marks only the rows that differ and never ranks", () => {
    const rows = compareListings([listing("a"), listing("b", { location: "Kandy", workMode: "remote" }, "Other Works")], fmtPay, fmtDate);
    expect(Object.fromEntries(rows.map(row => [row.field, row.differs]))).toEqual({ company: true, location: true, workMode: true, pay: false, expires: false });
    expect(rows.find(row => row.field === "pay")?.values).toEqual(["90000 LKR/month", "90000 LKR/month"]);
  });
  it("treats case and spacing as the same value, and an unstated pay as different from a stated one", () => {
    const rows = compareListings([listing("a", { location: "Colombo" }), listing("b", { location: " colombo ", salary: null })], fmtPay, fmtDate);
    expect(rows.find(row => row.field === "location")?.differs).toBe(false);
    expect(rows.find(row => row.field === "pay")).toMatchObject({ differs: true, values: ["90000 LKR/month", null] });
  });
  it("flags pay in different currencies or periods as not directly comparable, and never converts", () => {
    expect(payComparable([listing("a"), listing("b")])).toBe(true);
    expect(payComparable([listing("a"), listing("b", { currency: "USD" })])).toBe(false);
    expect(payComparable([listing("a"), listing("b", { payPeriod: "hour" })])).toBe(false);
    expect(payComparable([listing("a"), listing("b", { salary: null, currency: "USD" })])).toBe(true);
    const rows = compareListings([listing("a"), listing("b", { currency: "USD", salary: 500 })], fmtPay, fmtDate);
    expect(rows.find(row => row.field === "pay")?.values).toEqual(["90000 LKR/month", "500 USD/month"]);
  });
  it("limits the comparison to four listings", () => { expect(COMPARE_MAX).toBe(4); });
});

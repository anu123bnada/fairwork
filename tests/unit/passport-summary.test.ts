import { describe, expect, it } from "vitest";
import { groupPassportByYear, summarizePassport } from "@/features/work/passport-summary";
import type { Passport } from "@/features/work/passport-schema";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const entry = (n: number, over: Partial<Passport["entries"][number]> = {}): Passport["entries"][number] => ({
  workId: id(n), version: 1, role: "Cook", periodStart: "2025-01-01", periodEnd: "2025-03-01", hours: "100", summary: "s",
  companyId: id(100), companyName: "Acme", agreementId: id(200 + n), agreementVersion: 1, agreementHash: "a".repeat(64), agreementEffectiveAt: "2025-01-01T00:00:00Z",
  verificationId: id(300 + n), verifiedAt: "2025-03-02T00:00:00Z", verifierId: id(400), authorityDecisionId: id(500), evidenceCount: 2, evidenceHash: "b".repeat(64), ...over,
});

describe("passport summary", () => {
  it("is empty and honest with no records", () => {
    expect(summarizePassport([])).toEqual({ records: 0, hours: 0, employers: 0, evidenceStatements: 0, earliest: null, latest: null });
  });
  it("adds only what the verified rows state", () => {
    const summary = summarizePassport([entry(1), entry(2, { hours: "12.5", companyId: id(101), periodStart: "2024-02-01", periodEnd: "2024-04-01", evidenceCount: 0 }), entry(3, { hours: "n/a" })]);
    expect(summary).toEqual({ records: 3, hours: 112.5, employers: 2, evidenceStatements: 4, earliest: "2024-02-01", latest: "2025-03-01" });
  });
  it("groups newest first by the year each period ended", () => {
    const groups = groupPassportByYear([entry(1, { periodEnd: "2023-05-01" }), entry(2), entry(3, { periodEnd: "2025-09-01" })]);
    expect(groups.map(group => group.year)).toEqual(["2025", "2023"]);
    expect(groups[0]!.entries.map(e => e.workId)).toEqual([id(3), id(2)]);
  });
});

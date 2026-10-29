import { describe, expect, it } from "vitest";
import { isAgreementReference, mergeAgreementChoices } from "@/features/offer/agreement-choices";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
describe("agreement choices", () => {
  it("merges one agreement seen in several sources and puts open proposals first", () => {
    const list = mergeAgreementChoices(
      [{ agreementId: id(2), version: 3, expiresAt: "2026-11-01T00:00:00Z", expired: false, role: "worker" }],
      [{ agreementId: id(1), agreementVersion: 1, role: "Cook", companyName: "Acme", periodStart: "2025-01-01", periodEnd: "2025-02-01" }, { agreementId: id(2), agreementVersion: 2, role: "Cook", companyName: "Acme", periodStart: "2025-01-01", periodEnd: "2025-02-01" }],
      [id(3), id(2), "not-an-id"],
    );
    expect(list.map(c => c.agreementId)).toEqual([id(2), id(1), id(3)]);
    expect(list[0]).toMatchObject({ sources: ["open_proposal", "verified_work", "recent"], version: 3, role: "worker", companyName: "Acme" });
    expect(list[2]!.sources).toEqual(["recent"]);
  });
  it("validates a typed reference", () => {
    expect(isAgreementReference(` ${id(1)} `)).toBe(true);
    expect(isAgreementReference("abc")).toBe(false);
  });
});

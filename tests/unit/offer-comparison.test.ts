import { describe, expect, it } from "vitest";
import { compareOfferTerms, requireComparisonOffer } from "../../src/features/offer/comparison";
import type { AgreementRead } from "../../src/features/offer/read-schema";

const offer = (snapshot: Record<string, string | number>) => ({ snapshot }) as AgreementRead["offer"];
describe("saved offer comparison", () => {
  it("preserves currency and pay period rather than inventing normalized pay", () => {
    const rows = compareOfferTerms([offer({ salary: 100, currency: "USD", payPeriod: "hour" }), offer({ salary: 100, currency: "LKR", payPeriod: "month" })]);
    expect(rows.find(row => row.field === "salary")).toMatchObject({ values: ["100", "100"], differs: false });
    expect(rows.find(row => row.field === "currency")?.differs).toBe(true);
    expect(rows.find(row => row.field === "payPeriod")?.differs).toBe(true);
  });
  it("distinguishes missing data from zero and includes extension fields", () => {
    expect(compareOfferTerms([offer({ leave: 0, extra: "text" }), offer({ leave: "" })])).toEqual([
      { field: "extra", values: ["text", null], differs: true },
      { field: "leave", values: ["0", null], differs: true },
    ]);
  });
  it("rejects a response for a different requested offer", () => {
    expect(() => requireComparisonOffer({ offer: { offerId: "other" } } as AgreementRead, "expected")).toThrow("Unexpected offer response");
  });
});

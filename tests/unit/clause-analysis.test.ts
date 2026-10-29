import { describe, expect, it } from "vitest";
import { analyzeClauses } from "@/features/offer/clause-analysis";
import { assessExtractionQuality } from "@/features/offer/extraction-quality";

const ids = (text: string) => analyzeClauses(text).findings.map(finding => finding.id);

describe("clause analysis", () => {
  it("finds unclear wording and quotes the exact line with its position", () => {
    const text = "Job offer: Cashier\nSalary: LKR 60000 per month\nThe company may change these terms at any time without notice.\nBonus is at the discretion of management.";
    const result = analyzeClauses(text);
    const change = result.findings.find(finding => finding.id === "change-without-notice")!;
    expect(change.kind).toBe("unclear");
    expect(change.quote).toBe("The company may change these terms at any time without notice.");
    expect(text.slice(change.source!.start, change.source!.end)).toBe(change.quote);
    expect(ids(text)).toContain("discretion-pay");
  });

  it("reports the page a passage is on when the text carries page markers", () => {
    const text = "[Page 1]\nSalary: LKR 60000 per month\n40 hours per week\n\n[Page 2]\nAn employee who resigns within 24 months must repay a training bond.";
    const bond = analyzeClauses(text).findings.find(finding => finding.id === "bond-penalty")!;
    expect(bond.source!.page).toBe(2);
    expect(analyzeClauses("No markers: a training bond applies if you resign early.").findings.find(finding => finding.id === "bond-penalty")!.source!.page).toBeNull();
  });

  it("detects contradictions only when the text actually disagrees with itself", () => {
    expect(ids("Salary: LKR 60000 per month.\nIn another section: Basic pay LKR 45000 monthly.\n40 hours per week. Working 48 hours per week is normal.\nThis is a permanent post for a 6-month contract.")).toEqual(expect.arrayContaining(["contradiction-salary", "contradiction-hours", "contradiction-permanence"]));
    expect(ids("Salary: LKR 60000 per month.\nSalary of LKR 60000 is paid monthly.\n40 hours per week.")).not.toContain("contradiction-salary");
    expect(ids("There is no probation. Probation of 3 months applies.")).toContain("contradiction-probation");
  });

  it("flags suspicious promises and payment before work, with a question to ask", () => {
    const result = analyzeClauses("Earn up to $5000 per week from home, no experience needed.\nIncome is guaranteed.\nPay a fee before starting to secure your place.");
    expect(result.findings.map(finding => finding.id)).toEqual(expect.arrayContaining(["promise-easy-money", "promise-guaranteed", "promise-pay-first"]));
    expect(result.findings.every(finding => finding.question.endsWith("?"))).toBe(true);
  });

  it("calls a term missing only for a text long enough to judge, and says so", () => {
    const longOffer = "We are pleased to offer you the position of Warehouse Assistant at Example Stores. The role starts in January and reports to the shift manager. Please sign and return this letter to accept.";
    const missing = analyzeClauses(longOffer).findings.filter(finding => finding.kind === "missing").map(finding => finding.id);
    expect(missing).toEqual(expect.arrayContaining(["missing-salary", "missing-hours", "missing-leave", "missing-termination"]));
    expect(analyzeClauses("Barista needed").findings).toEqual([]);
    expect(analyzeClauses("").findings).toEqual([]);
    expect(analyzeClauses(longOffer).limitations).toMatch(/cannot see what was agreed verbally/);
  });

  it("does not flag a plain, complete offer", () => {
    const text = "Position: Warehouse Assistant. Salary: LKR 70000 per month, paid on the last working day. 40 hours per week, Monday to Friday. Annual leave 14 days and sick leave 7 days. Benefits: EPF and ETF. Notice period: one month by either side.";
    expect(analyzeClauses(text).findings).toEqual([]);
  });
});

describe("extraction quality", () => {
  const good = "Position: Warehouse Assistant. Salary: LKR 70000 per month. 40 hours per week, Monday to Friday. Annual leave 14 days.";
  it("passes ordinary text and always asks for a check after OCR", () => {
    expect(assessExtractionQuality(good, { source: "pdf" }).level).toBe("good");
    const ocr = assessExtractionQuality(good, { source: "ocr" });
    expect(ocr.level).toBe("check"); expect(ocr.reasons).toContain("ocr");
  });
  it("marks tiny, symbol-heavy and corrupted text as poor, and truncated text as needing a check", () => {
    expect(assessExtractionQuality("Salary 5", { source: "pdf" }).level).toBe("poor");
    expect(assessExtractionQuality("|||| ~~~~ ^^^^ #### //// \\\\ ==== ???? ||| ~~ ^^ ## // \\\\ == ?? |||| ~~~~", { source: "ocr" }).reasons).toContain("symbols");
    expect(assessExtractionQuality(`${good} ��`, { source: "docx" })).toMatchObject({ level: "poor" });
    expect(assessExtractionQuality(good, { source: "pdf", truncated: true })).toMatchObject({ level: "check", reasons: ["truncated"] });
  });
  it("flags fused letter-and-digit tokens that suggest misread characters, and ignores page markers", () => {
    const misread = "Pos1tion Warehouse Ass1stant S4lary 5OOOO per m0nth w0rking h0urs t0 be c0nfirmed ann4al leave";
    expect(assessExtractionQuality(misread, { source: "pdf" }).reasons).toContain("mixed_tokens");
    expect(assessExtractionQuality(`[Page 1]\n${good}\n[Page 2]`, { source: "pdf" }).characters).toBe(good.length);
  });
});

import { expect, it } from "vitest";
import { extractOfferTermsRuleBased as extract } from "@/features/offer/deterministic-extractor";
it("does not truncate ungrouped compensation numbers", () => {
 expect(extract("Salary: LKR 80000 per month").detectedTerms).toMatchObject({ salary: 80000, currency: "LKR" });
 expect(extract("Salary: USD 4,500.50 monthly").detectedTerms.salary).toBe(4500.5);
});
it("does not invent currency or weekly hours from ambiguous symbols and daily schedules", () => {
 const result = extract("Salary: $4500; 8 hours per day");
 expect(result.data.salary.currency).toBeNull(); expect(result.detectedTerms.currency).toBeUndefined();
 expect(result.data.workingHours.hoursPerWeek).toBeNull();
 expect(extract("Salary: Rs 80000").data.salary.currency).toBeNull();
 expect(extract("Work 40 hours per week").detectedTerms.hoursPerWeek).toBe(40);
});
it("requires a stated role rather than interpreting arbitrary first-line text as a job", () => {
 expect(extract("LKR 50000 monthly").detectedTerms.role).toBeUndefined();
 expect(extract("Role: Technician").detectedTerms.role).toBe("Technician");
});
it("every rule quotation is an exact source substring and phrases are not verification", () => {
 const text = "No training fee applies. No unpaid probation. Never surrender documents. Overtime is mandatory and uncompensated.";
 const { data } = extract(text);
 expect(data.warningSigns).toHaveLength(4);
 for (const item of data.warningSigns) expect(text).toContain(item.quote);
 expect(data.companyClaimNotice).toContain("cannot verify");
});
it("extracts a fictional pasted offer while distinguishing a deposit from salary", () => {
 const text = `We are hiring a Maintenance Technician at Example Workshop.
Security deposit: LKR 5000, refundable
Salary: LKR 85k per month
Weekly working hours: 40
Start date: 2026-11-01
Responsibilities: Inspect and maintain workshop equipment
Employment type: Full time
Probation: Three months
Notice period: One month
Benefits: Transport allowance
Payment date: Last working day
Overtime: Agreed in writing
Location: Colombo`;
 expect(extract(text).detectedTerms).toMatchObject({ role: "Maintenance Technician", salary: 85000, currency: "LKR", hoursPerWeek: 40, startDate: "2026-11-01", responsibilities: "Inspect and maintain workshop equipment", employmentType: "Full time", probation: "Three months", notice: "One month", benefits: "Transport allowance", paymentDate: "Last working day", overtime: "Agreed in writing", location: "Colombo", contractConditions: "Security deposit: LKR 5000, refundable" });
});
it("leaves ranges and competing salaries unresolved instead of picking an endpoint", () => {
 for (const text of ["Salary: LKR 50000–80000", "Salary: USD 2000 or EUR 1800", "Salary: LKR 50000\nSalary: LKR 60000", "Training fee: LKR 5000", "Salary: up to LKR 80000"]) expect(extract(text).detectedTerms.salary).toBeUndefined();
 for (const text of ["35–40 hours/week", "Hours per week: 35–40", "up to 40 hours per week"]) expect(extract(text).detectedTerms.hoursPerWeek).toBeUndefined();
});
it("supports explicit pay and title labels without inventing currency", () => {
 expect(extract("**Job title:** Technician\nPay: 80000\n40 hrs/week").detectedTerms).toMatchObject({ role: "Technician", salary: 80000, hoursPerWeek: 40 });
 expect(extract("Pay: 80000").detectedTerms.currency).toBeUndefined();
});
it("preserves separately stated pay basis, leave, duration, employer claims and protections",()=>{
 const text="Salary: LKR 80000 gross monthly; Training deposit: Not required\nSchedule: Monday to Friday\nLeave: 20 paid days\nDuration: Ongoing\nDocument retention: Worker keeps originals\nCompany: Fictional Workshop";
 const result=extract(text);
 expect(result.detectedTerms).toMatchObject({salary:80000,payPeriod:"monthly",taxBasis:"gross",trainingDeposit:"Not required",schedule:"Monday to Friday",leave:"20 paid days",contractDuration:"Ongoing",documentRetention:"Worker keeps originals",employerName:"Fictional Workshop"});
 expect(result.data.contractTerms.duration).toBe("Ongoing");expect(result.data.salary.taxBasis).toBe("gross");
 expect(result.detectedTerms).not.toHaveProperty("companyId");
});
it("does not resolve contradictory hours or repeated clauses silently",()=>{
 expect(extract("40 hours per week\nHours per week: 60").detectedTerms.hoursPerWeek).toBeUndefined();
 expect(extract("Leave: 10 days\nLeave: 20 days").detectedTerms.leave).toBeUndefined();
 expect(extract("40 hours per week\n40 hrs/week").detectedTerms.hoursPerWeek).toBe(40);
});

it("reads a dot-grouped amount such as EUR 2.400 as 2400, not 2.4, and still reads plain decimals", async () => {
  const { extractOfferTermsRuleBased } = await import("@/features/offer/deterministic-extractor");
  expect(extractOfferTermsRuleBased("Salary: EUR 2.400 per month").detectedTerms).toMatchObject({ salary: 2400, currency: "EUR" });
  expect(extractOfferTermsRuleBased("Salary: EUR 12.000 per year").detectedTerms).toMatchObject({ salary: 12000 });
  expect(extractOfferTermsRuleBased("Salary: USD 18.50 per hour").detectedTerms).toMatchObject({ salary: 18.5 });
});

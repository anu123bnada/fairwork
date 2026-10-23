import { expect,it } from "vitest";
import { redactOfferForAi } from "@/features/offer/ai-redaction";
it("minimizes recognizable personal details without stripping salary and hours",()=>{
 const text="Name: Synthetic Person\nAddress: Private location\nPhone: 0771234567\nEmail test@example.test or +94 77 123 4567\nID 199012345678\nSalary: LKR 80000 monthly\n40 hours per week\nhttps://example.test/private?token=hidden";
 const result=redactOfferForAi(text);
 for(const secret of ["Synthetic Person","Private location","0771234567","test@example.test","+94 77 123 4567","199012345678","token=hidden"])expect(result).not.toContain(secret);
 expect(result).toContain("LKR 80000 monthly");expect(result).toContain("40 hours per week");
 expect(redactOfferForAi(result)).toBe(result);
});
it("does not pretend that unlabelled narrative names are anonymized",()=>{
 expect(redactOfferForAi("Alex works with Sam for 40 hours per week")).toContain("Alex");
});

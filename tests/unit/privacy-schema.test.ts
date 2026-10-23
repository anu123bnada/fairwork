import { expect, it } from "vitest";
import { privacyCommand, privacyQuery, privacyReview } from "@/features/identity/privacy-schema";
const requestId = "40000000-0000-4000-8000-000000000001";
it("rejects forged subject, operator authority and unknown privacy operations", () => {
 expect(privacyCommand.safeParse({operation:"create",kind:"deletion",scope:"My account",subjectId:requestId}).success).toBe(false);
 expect(privacyCommand.safeParse({operation:"erase",requestId}).success).toBe(false);
 expect(privacyReview.safeParse({operation:"review",requestId,expectedRevision:0,status:"in_review",note:"Review",evidenceRef:null,capability:"privacy_operator"}).success).toBe(false);
 expect(privacyQuery.safeParse({requestId,cursor:requestId}).success).toBe(false);
});
it("requires an auditable fulfillment reference and bounded exact revisions", () => {
 const review={operation:"review",requestId,expectedRevision:1,status:"fulfilled",note:"Manual procedure completed",evidenceRef:null};
 expect(privacyReview.safeParse(review).success).toBe(false);
 expect(privacyReview.safeParse({...review,evidenceRef:"local-review-reference"}).success).toBe(true);
 expect(privacyReview.safeParse({...review,expectedRevision:20,evidenceRef:"local-review-reference"}).success).toBe(false);
 expect(privacyCommand.safeParse({operation:"create",kind:"access",scope:"   "}).success).toBe(false);
});
it("reserves the last bounded audit slot for a terminal decision or owner withdrawal", () => {
 const review={operation:"review",requestId,expectedRevision:19,status:"in_review",note:"More review",evidenceRef:null};
 expect(privacyReview.safeParse(review).success).toBe(false);
 expect(privacyReview.safeParse({...review,status:"declined"}).success).toBe(true);
 expect(privacyCommand.safeParse({operation:"withdraw",requestId,expectedRevision:19}).success).toBe(true);
});

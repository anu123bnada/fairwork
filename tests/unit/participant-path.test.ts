import { describe, expect, it } from "vitest";
import { participantOfferId,participantCaseId,participantDestination,participantGrantId,participantAgreementBasisId } from "@/features/offer/participant-path";

describe("participant sign-in selection", () => {
  it("carries only a validated agreement basis to work creation, preserving explicit record priority",()=>{
    const id="40000000-0000-4000-8000-000000000003";
    expect(participantDestination(`?agreementBasisId=${id}&next=https://foreign.invalid`)).toBe(`/app/work-record?agreementBasisId=${id}`);
    expect(participantDestination(`?workId=${id}&agreementBasisId=${id}`)).toBe(`/app/work-record?workId=${id}`);
    for(const query of [`?agreementBasisId=${id}&agreementBasisId=${id}`,"?agreementBasisId=//foreign.invalid",`?agreementBasisId=${id}/..`])expect(participantAgreementBasisId(query)).toBeNull();
  });
  it("preserves a named-recipient grant without accepting an arbitrary redirect",()=>{
    const id="40000000-0000-4000-8000-000000000003";
    expect(participantDestination(`?grantId=${id}&next=https://foreign.invalid`)).toBe(`/app/share?grantId=${id}`);
    for(const value of [`?grantId=${id}&grantId=${id}`,"?grantId=//foreign.invalid",`?grantId=${id}/..`])expect(participantGrantId(value)).toBeNull();
  });
  it("carries only a single validated case ID to a fixed authorized destination",()=>{const id="40000000-0000-4000-8000-000000000003";expect(participantDestination(`?caseId=${id}&next=https://foreign.invalid`)).toBe(`/app/cases?caseId=${id}`);for(const search of [`?caseId=${id}&caseId=${id}`,"?caseId=//foreign.invalid",`?caseId=${id}/..`])expect(participantCaseId(search)).toBeNull();});
  it("accepts only one valid UUID and never accepts a redirect URL", () => {
    const id = "40000000-0000-4000-8000-000000000003";
    expect(participantOfferId(`?offerId=${id}&next=https://example.invalid`)).toBe(id);
    for (const search of ["", "?next=//example.invalid", "?offerId=javascript:alert(1)",
      "?offerId=%2F%2Fexample.invalid", `?offerId=${id}&offerId=${id}`, `?offerId=${id}%2F..`]) {
      expect(participantOfferId(search)).toBeNull();
    }
  });
});

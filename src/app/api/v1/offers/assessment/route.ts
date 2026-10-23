import { apiResponse } from "@/server/http";
import { readAgreement } from "@/server/offer";
import { agreementReadRequestSchema } from "@/features/offer/read-schema";
import { assessOfferTerms } from "@/features/offer/assessment";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 return apiResponse(async()=>{
  const query=new URL(request.url).searchParams;
  const input=agreementReadRequestSchema.safeParse(Object.fromEntries(query));
  if(!input.success||query.size!==1)throw new AppError("VALIDATION_FAILED",422);
  // Existing authenticated RPC/RLS is the only source of participants and terms.
  const {offer}=await readAgreement(input.data);
  if(offer.offerId!==input.data.offerId)throw new AppError("SERVICE_UNAVAILABLE",503);
  return {offerId:offer.offerId,offerVersion:offer.version,termHash:offer.termHash,assessment:assessOfferTerms(offer.snapshot)};
 },"offer-indicators.v1");
}

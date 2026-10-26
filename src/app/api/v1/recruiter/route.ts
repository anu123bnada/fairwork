import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { recruiterContext } from "@/server/recruiter/context";
import { createVerification, listVerifications } from "@/server/recruiter/service";
import { claimInput } from "@/features/recruiter/schema";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams.keys()].length) throw new AppError("VALIDATION_FAILED", 422);
    return listVerifications((await recruiterContext()).rpc);
  }, "recruiter-verification.v1");
}

// Records who a recruiter claims to be. The claim is immutable; to correct it, delete it and make a new one.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, claimInput);
    return createVerification((await recruiterContext()).rpc, input);
  }, "recruiter-verification.v1");
}

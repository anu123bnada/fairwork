import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { recruiterContext } from "@/server/recruiter/context";
import { decide } from "@/server/recruiter/service";
import { decideInput } from "@/features/recruiter/schema";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

// An approved representative confirms, disputes or withdraws. The database requires current authority for the verification's own
// organization, refuses the requester, and keeps every decision.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, decideInput);
    if ((input.decision === "confirm") !== (input.validDays !== null)) throw new AppError("VALIDATION_FAILED", 422);
    return decide((await recruiterContext()).rpc, input);
  }, "recruiter-verification.v1");
}

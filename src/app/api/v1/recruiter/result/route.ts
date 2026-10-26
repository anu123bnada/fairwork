import { z } from "zod";
import { apiResponse } from "@/server/http";
import { recruiterContext } from "@/server/recruiter/context";
import { verificationResult } from "@/server/recruiter/service";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The current picture for one of the caller's own verifications. Evidence is read fresh and dated; nothing is cached.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const id = z.uuid().safeParse(query.get("id"));
    if (!id.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return verificationResult((await recruiterContext({ fetches: true })).rpc, id.data);
  }, "recruiter-verification.v1");
}

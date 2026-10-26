import { z } from "zod";
import { apiResponse } from "@/server/http";
import { recruiterContext } from "@/server/recruiter/context";
import { approvalQueue } from "@/server/recruiter/service";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

// Requests naming the caller's organizations, for approved representatives only (the database decides). The requester is never shown.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const cursor = z.uuid().nullable().safeParse(query.get("cursor"));
    if (!cursor.success || [...query.keys()].some(key => key !== "cursor")) throw new AppError("VALIDATION_FAILED", 422);
    return approvalQueue((await recruiterContext()).rpc, cursor.data);
  }, "recruiter-verification.v1");
}

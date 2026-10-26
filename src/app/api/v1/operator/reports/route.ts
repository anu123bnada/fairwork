import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { signedInClient } from "@/server/developer/session";
import { reviewQueue, reviewReport } from "@/server/reports";
import { reviewInput } from "@/features/reports/schema";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

// Reviewer queue: the reporter's identity is never included. The database requires the review_operator capability and a second factor.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const status = z.enum(["open", "closed"]).safeParse(query.get("status") ?? "open");
    if (!status.success || [...query.keys()].some(key => key !== "status")) throw new AppError("VALIDATION_FAILED", 422);
    return reviewQueue((await signedInClient()).rpc, status.data);
  }, "report-review.v1");
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, reviewInput);
    return reviewReport((await signedInClient()).rpc, input);
  }, "report-review.v1");
}

import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { signedInClient } from "@/server/developer/session";
import { createReport, listReports } from "@/server/reports";
import { reportInput } from "@/features/reports/schema";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

// The caller's own reports and what reviewers wrote back.
export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams.keys()].length) throw new AppError("VALIDATION_FAILED", 422);
    return listReports((await signedInClient()).rpc);
  }, "reports.v1");
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, reportInput);
    return createReport((await signedInClient()).rpc, input);
  }, "reports.v1");
}

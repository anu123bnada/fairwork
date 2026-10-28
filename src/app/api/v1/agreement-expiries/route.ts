import { apiResponse } from "@/server/http";
import { listExpiries } from "@/server/agreement-expiry";
export const dynamic = "force-dynamic";

// The caller's open proposals that have an expiry date, soonest first (used for reminders).
export async function GET() {
  return apiResponse(async () => listExpiries(), "agreement-workflow.v1");
}

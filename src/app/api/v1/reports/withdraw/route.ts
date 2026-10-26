import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { signedInClient } from "@/server/developer/session";
import { withdrawReport } from "@/server/reports";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { reportId } = await readJson(request, z.strictObject({ reportId: z.uuid() }));
    return withdrawReport((await signedInClient()).rpc, reportId);
  }, "reports.v1");
}

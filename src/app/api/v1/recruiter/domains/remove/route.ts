import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { recruiterContext } from "@/server/recruiter/context";
import { removeDomain } from "@/server/recruiter/service";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { domainId } = await readJson(request, z.strictObject({ domainId: z.uuid() }));
    return removeDomain((await recruiterContext()).rpc, domainId);
  }, "recruiter-verification.v1");
}

import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { recruiterContext } from "@/server/recruiter/context";
import { deleteVerification } from "@/server/recruiter/service";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { verificationId } = await readJson(request, z.strictObject({ verificationId: z.uuid() }));
    return deleteVerification((await recruiterContext()).rpc, verificationId);
  }, "recruiter-verification.v1");
}

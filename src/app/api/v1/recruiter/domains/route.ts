import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { recruiterContext } from "@/server/recruiter/context";
import { claimDomain, domainsWithProof } from "@/server/recruiter/service";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// An organization's claimed domains, with whether the token can be seen right now (so a representative can tell if publishing it worked).
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const company = z.uuid().safeParse(query.get("companyId"));
    if (!company.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return { items: await domainsWithProof((await recruiterContext({ fetches: true })).rpc, company.data) };
  }, "recruiter-verification.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, z.strictObject({ companyId: z.uuid(), domain: z.string().trim().min(4).max(253) }));
    return claimDomain((await recruiterContext()).rpc, input.companyId, input.domain);
  }, "recruiter-verification.v1");
}

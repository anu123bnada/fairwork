import { z } from "zod";
import { apiResponse } from "@/server/http";
import { recruiterContext } from "@/server/recruiter/context";
import { searchCompanies } from "@/server/recruiter/service";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

// ORYQEN organizations that currently have an approved representative, by name prefix, so a claim can name the employer.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const name = z.string().trim().min(4).max(80).safeParse(query.get("query"));
    if (!name.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return searchCompanies((await recruiterContext()).rpc, name.data);
  }, "recruiter-verification.v1");
}

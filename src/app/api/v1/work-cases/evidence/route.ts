import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { attachCaseEvidence, listCaseEvidence } from "@/server/case-evidence";
import { caseEvidenceAttachInput } from "@/features/cases/evidence";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const id = z.uuid().safeParse(query.get("caseId"));
    if (!id.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return listCaseEvidence(id.data);
  }, "work-case.v1");
}
// Attach one of the caller's own vault documents to a case they opened, as an evidence reference.
export async function POST(request: Request) {
  return apiResponse(async () => { assertSameOrigin(request); return attachCaseEvidence(await readJson(request, caseEvidenceAttachInput)); }, "work-case.v1");
}

import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { workflowCommandSchema, workflowReadRequestSchema } from "@/features/offer/workflow-schema";
import { agreementWorkflow } from "@/server/agreement-workflow";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export async function GET(request:Request) {
  return apiResponse(async()=>{
    const query=new URL(request.url).searchParams;
    const input=workflowReadRequestSchema.safeParse(Object.fromEntries(query));
    if(!input.success || [...query.keys()].length!==1) throw new AppError("VALIDATION_FAILED",422);
    return agreementWorkflow(input.data);
  },"agreement-workflow.v1");
}
export async function POST(request:Request) {
  return apiResponse(async()=>{
    assertSameOrigin(request);
    return agreementWorkflow(await readJson(request,workflowCommandSchema));
  },"agreement-workflow.v1");
}

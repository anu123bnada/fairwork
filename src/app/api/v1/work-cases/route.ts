import { apiResponse,assertSameOrigin,readJson } from "@/server/http";
import { caseCommandSchema,caseReadRequestSchema,caseListRequestSchema } from "@/features/cases/schema";
import { workCaseService } from "@/server/work-cases";
import { AppError } from "@/lib/errors";
export const dynamic="force-dynamic";
export async function GET(request:Request) {return apiResponse(async()=>{
 const query=new URL(request.url).searchParams;
 if([...new Set(query.keys())].length!==query.size)throw new AppError("VALIDATION_FAILED",422);
 const input=query.has("caseId")?caseReadRequestSchema.safeParse(Object.fromEntries(query)):caseListRequestSchema.safeParse({cursor:null,workId:null,...Object.fromEntries(query)});
 if(!input.success)throw new AppError("VALIDATION_FAILED",422);return workCaseService(input.data);
},"work-case.v1");}
export async function POST(request:Request) {return apiResponse(async()=>{assertSameOrigin(request);return workCaseService(await readJson(request,caseCommandSchema));},"work-case.v1");}

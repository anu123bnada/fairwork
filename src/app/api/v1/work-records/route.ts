import { apiResponse,assertSameOrigin,readJson } from "@/server/http";
import { workCommandSchema,workReadRequestSchema,workListRequestSchema } from "@/features/work/schema";
import { workService } from "@/server/work";
import { AppError } from "@/lib/errors";
export const dynamic="force-dynamic";
export async function GET(request:Request) {return apiResponse(async()=>{
 const query=new URL(request.url).searchParams;
 if([...query.keys()].length>1)throw new AppError("VALIDATION_FAILED",422);
 const input=query.has("workId")?workReadRequestSchema.safeParse(Object.fromEntries(query)):workListRequestSchema.safeParse(query.size?Object.fromEntries(query):{cursor:null});
 if(!input.success)throw new AppError("VALIDATION_FAILED",422);return workService(input.data);
},"work-record.v1");}
export async function POST(request:Request) {return apiResponse(async()=>{assertSameOrigin(request);return workService(await readJson(request,workCommandSchema));},"work-record.v1");}

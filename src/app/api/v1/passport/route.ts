import { apiResponse,assertSameOrigin,readJson } from "@/server/http";
import { passportReadRequestSchema,passportInitializeSchema } from "@/features/work/passport-schema";
import { workIntegrityService } from "@/server/work-integrity";
import { AppError } from "@/lib/errors";
export const dynamic="force-dynamic";
export async function GET(request:Request){return apiResponse(async()=>{
 const query=new URL(request.url).searchParams;
 if([...query.keys()].length>1)throw new AppError("VALIDATION_FAILED",422);
 const input=passportReadRequestSchema.safeParse(query.size?Object.fromEntries(query):{cursor:null});
 if(!input.success)throw new AppError("VALIDATION_FAILED",422);return workIntegrityService(input.data);
},"private-work-passport.v1");}
export async function POST(request:Request){return apiResponse(async()=>{assertSameOrigin(request);return workIntegrityService(await readJson(request,passportInitializeSchema));},"private-work-passport.v1");}

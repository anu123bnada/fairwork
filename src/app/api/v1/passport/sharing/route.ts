import { apiResponse,assertSameOrigin,readJson } from "@/server/http";
import { shareCommand,shareQuery } from "@/features/work/sharing-schema";
import { sharingService } from "@/server/passport-sharing";
import { AppError } from "@/lib/errors";
export const dynamic="force-dynamic";
export async function GET(request:Request){return apiResponse(async()=>{
 const query=new URL(request.url).searchParams;
 if(new Set(query.keys()).size!==query.size)throw new AppError("VALIDATION_FAILED",422);
 const parsed=shareQuery.safeParse(Object.fromEntries(query));if(!parsed.success)throw new AppError("VALIDATION_FAILED",422);
 return sharingService("grantId" in parsed.data?"passport_projection":"passport_share_list",parsed.data);
},"passport-sharing.v1");}
export async function POST(request:Request){return apiResponse(async()=>{assertSameOrigin(request);return sharingService("passport_share_command",await readJson(request,shareCommand));},"passport-sharing.v1");}

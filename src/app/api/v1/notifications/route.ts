import { apiResponse,assertSameOrigin,readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError,mapDatabaseError } from "@/lib/errors";
import { notificationCursor,notificationRead,notificationList,notificationReceipt } from "@/features/identity/notifications-schema";
import type { Json } from "@/types/database";
export const dynamic="force-dynamic";
async function execute(input:Json,read=false){
 const client=await createServerSupabase(true);const {data,error}=await client.auth.getUser();
 if(error&&(error.status??0)>=500)throw new AppError("SERVICE_UNAVAILABLE",503);
 if(error||!data.user||data.user.is_anonymous)throw new AppError("AUTH_REQUIRED",401);
 const result=await client.rpc("notifications",{request:input});if(result.error)throw mapDatabaseError(result.error);
 const parsed=(read?notificationReceipt:notificationList).safeParse(result.data);if(!parsed.success)throw new AppError("SERVICE_UNAVAILABLE",503);return parsed.data;
}
export async function GET(request:Request){return apiResponse(async()=>{
 const query=new URL(request.url).searchParams;if(new Set(query.keys()).size!==query.size)throw new AppError("VALIDATION_FAILED",422);
 const parsed=notificationCursor.safeParse(Object.fromEntries(query));if(!parsed.success)throw new AppError("VALIDATION_FAILED",422);
 return execute({operation:"list",...parsed.data});
},"notifications.v1");}
export async function POST(request:Request){return apiResponse(async()=>{assertSameOrigin(request);return execute({operation:"read",...await readJson(request,notificationRead)},true);},"notifications.v1");}

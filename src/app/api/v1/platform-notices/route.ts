import {apiResponse} from "@/server/http";
import {createServerSupabase} from "@/server/supabase";
import {AppError,mapDatabaseError} from "@/lib/errors";
export async function GET(request:Request){return apiResponse(async()=>{
 if(new URL(request.url).search)throw new AppError("VALIDATION_FAILED",422);
 const client=await createServerSupabase(true);const user=await client.auth.getUser();if(user.error||!user.data.user||user.data.user.is_anonymous)throw new AppError("AUTH_REQUIRED",401);
 const result=await client.rpc("platform_notices",{request:{}});if(result.error)throw mapDatabaseError(result.error);return result.data;
},"platform-notices.v1");}

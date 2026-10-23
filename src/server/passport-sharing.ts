import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError,mapDatabaseError } from "@/lib/errors";
import { shareList,shareProjection,shareReceipt } from "@/features/work/sharing-schema";
import type { Json } from "@/types/database";
export async function sharingService(command:"passport_projection"|"passport_share_list"|"passport_share_command",request:Json){
 const client=await createServerSupabase(true);const {data,error}=await client.auth.getUser();
 if(error&&(error.status??0)>=500)throw new AppError("SERVICE_UNAVAILABLE",503);
 if(error||!data.user||data.user.is_anonymous)throw new AppError("AUTH_REQUIRED",401);
 const result=await client.rpc(command,{request});if(result.error)throw mapDatabaseError(result.error);
 const parsed=(command==="passport_projection"?shareProjection:command==="passport_share_list"?shareList:shareReceipt).safeParse(result.data);
 if(!parsed.success)throw new AppError("SERVICE_UNAVAILABLE",503);return parsed.data;
}

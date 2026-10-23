import "server-only";
import {createServerSupabase} from "./supabase";
import {AppError,mapDatabaseError} from "@/lib/errors";
import {adminResponse,adminReceipt} from "@/features/admin/schema";
import type {Json} from "@/types/database";
import {aiConfiguration} from "./ai/config";
import {telemetryStatus} from "./telemetry";
export async function adminService(operation:"admin_read"|"admin_command",request:Json,canWriteCookies=true){
 const client=await createServerSupabase(canWriteCookies);const identity=await client.auth.getUser();
 if(identity.error||!identity.data.user||identity.data.user.is_anonymous)throw new AppError("AUTH_REQUIRED",401);
 const result=await client.rpc(operation,{request});if(result.error)throw mapDatabaseError(result.error);
 const parsed=(operation==="admin_read"?adminResponse:adminReceipt).safeParse(result.data);if(!parsed.success)throw new AppError("SERVICE_UNAVAILABLE",503);return parsed.data;
}
// Called only after database admin authorization, never returns credential values.
export function adminRuntime(){const config=aiConfiguration();return {provider:config?.provider??"gemini",model:config?.model??null,liveProcessingConfigured:Boolean(config),telemetry:telemetryStatus(),providerAvailability:"not_probed",providerCost:null,ruleBasedFallback:true,limits:{dailyPlatform:100,dailyAccount:10,minuteAccount:3},retentionPolicy:"approval_required",registrationEnabled:process.env.AUTH_REGISTRATION_ENABLED==="true",backend:"authenticated_database_read_passed",build:"0.1.0",release:"NO-GO",dataMode:"synthetic"};}

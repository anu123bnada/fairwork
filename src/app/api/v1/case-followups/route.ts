import {apiResponse,assertSameOrigin,idempotencyKey,readJson} from "@/server/http";
import {createServerSupabase} from "@/server/supabase";
import {AppError,mapDatabaseError} from "@/lib/errors";
import {followupRead,followupCommand,followupReceipt,followupPage} from "@/features/cases/followup-schema";
import type {Json} from "@/types/database";
async function execute(operation:"case_followup_read"|"case_followup_command",request:Json){const client=await createServerSupabase(true);const user=await client.auth.getUser();if(user.error||!user.data.user||user.data.user.is_anonymous)throw new AppError("AUTH_REQUIRED",401);const result=await client.rpc(operation,{request});if(result.error)throw mapDatabaseError(result.error);const parsed=(operation==="case_followup_read"?followupPage:followupReceipt).safeParse(result.data);if(!parsed.success)throw new AppError("SERVICE_UNAVAILABLE",503);return parsed.data;}
export async function GET(request:Request){return apiResponse(async()=>{const params=new URL(request.url).searchParams;if(new Set(params.keys()).size!==params.size)throw new AppError("VALIDATION_FAILED",422);const parsed=followupRead.safeParse(Object.fromEntries(params));if(!parsed.success)throw new AppError("VALIDATION_FAILED",422);return execute("case_followup_read",parsed.data);},"case-followup.v1");}
export async function POST(request:Request){return apiResponse(async()=>{assertSameOrigin(request);return execute("case_followup_command",{...await readJson(request,followupCommand),idempotencyKey:idempotencyKey(request)});},"case-followup.v1");}

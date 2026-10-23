import {organizationAppealSchema,organizationAppealReceipt} from "@/features/authority/organization-schema";
import {apiResponse,assertSameOrigin,idempotencyKey,readJson} from "@/server/http";
import {createServerSupabase} from "@/server/supabase";
import {AppError,mapDatabaseError} from "@/lib/errors";
export async function POST(request:Request){
 return apiResponse(async()=>{
  assertSameOrigin(request);
  const input=await readJson(request,organizationAppealSchema),key=idempotencyKey(request);
  const client=await createServerSupabase(true),identity=await client.auth.getUser();
  if(identity.error||!identity.data.user||identity.data.user.is_anonymous)throw new AppError("AUTH_REQUIRED",401);
  const result=await client.rpc("appeal_organization_request",{request:{...input,idempotencyKey:key}});
  if(result.error)throw mapDatabaseError(result.error);
  const parsed=organizationAppealReceipt.safeParse(result.data);if(!parsed.success)throw new AppError("SERVICE_UNAVAILABLE",503);
  return parsed.data;
 },"organization-appeal.v1");
}

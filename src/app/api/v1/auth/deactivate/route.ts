import { apiResponse, assertSameOrigin, idempotencyKey, readJson } from "@/server/http";
import { deactivationInput, deactivationReceipt } from "@/features/identity/deactivation-schema";
import { createServerSupabase } from "@/server/supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
export async function POST(request: Request) {
 return apiResponse(async()=>{
  assertSameOrigin(request);
  const input=await readJson(request,deactivationInput),key=idempotencyKey(request);
  const client=await createServerSupabase(true);
  const {data:identity,error:authError}=await client.auth.getUser();
  if(authError&&(authError.status??0)>=500)throw new AppError("SERVICE_UNAVAILABLE",503);
  if(authError||!identity.user||identity.user.is_anonymous)throw new AppError("AUTH_REQUIRED",401);
  const {data,error}=await client.rpc("deactivate_account",{request:{...input,idempotencyKey:key}});
  if(error)throw mapDatabaseError(error);
  const receipt=deactivationReceipt.safeParse(data);
  if(!receipt.success)throw new AppError("INTERNAL_ERROR",500);
  // The committed PostgreSQL state is authoritative even if Auth is unavailable.
  // Global sign-out invalidates refresh tokens; existing JWTs are denied by RLS.
  let sessionsRevoked=false;
  try {sessionsRevoked=!(await client.auth.signOut({scope:"global"})).error;} catch { /* Account remains deactivated. Never log provider details. */ }
  return {...receipt.data,sessionsRevoked};
 },"account-deactivation.v1");
}

import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { employmentList, employmentSave, employmentPage, employmentReceipt } from "@/features/work/employment-schema";
import { createServerSupabase } from "@/server/supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";
async function execute(request: Json, save = false) {
 const client = await createServerSupabase(true);
 const { data: identity, error: authError } = await client.auth.getUser();
 if (isAuthServiceUnavailable(authError)) throw new AppError("SERVICE_UNAVAILABLE",503);
 if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED",401);
 const {data,error} = await client.rpc("employment_history",{request});
 if(error) throw mapDatabaseError(error);
 const parsed = (save ? employmentReceipt : employmentPage).safeParse(data);
 if(!parsed.success) throw new AppError("SERVICE_UNAVAILABLE",503);
 return parsed.data;
}
export async function GET(request: Request) { return apiResponse(async()=>{
 const query=new URL(request.url).searchParams;
 if(query.size>1 || [...query.keys()].some(key=>key!=="cursor")) throw new AppError("VALIDATION_FAILED",422);
 const parsed=employmentList.safeParse({operation:"list",cursor:query.get("cursor")});
 if(!parsed.success) throw new AppError("VALIDATION_FAILED",422);
 return execute(parsed.data);
},"employment-history.v1"); }
export async function POST(request: Request) { return apiResponse(async()=>{assertSameOrigin(request);return execute(await readJson(request,employmentSave),true);},"employment-history.v1"); }

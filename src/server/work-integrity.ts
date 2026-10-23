import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError,mapDatabaseError } from "@/lib/errors";
import { integrityReceiptSchema,type IntegrityCommand } from "@/features/work/integrity-schema";
import { passportSchema,passportReceiptSchema } from "@/features/work/passport-schema";
export async function workIntegrityService(request:IntegrityCommand|{cursor:string|null}|{idempotencyKey:string}) {
 const rpc="operation" in request?"work_integrity":"cursor" in request?"read_passport":"initialize_passport";
 const schema=rpc==="work_integrity"?integrityReceiptSchema:rpc==="read_passport"?passportSchema:passportReceiptSchema;
 for(let attempt=0;attempt<3;attempt++) {
  const client=await createServerSupabase(true);
  const {data:identity,error:authError}=await client.auth.getUser();
  if(authError&&(authError.status??0)>=500)throw new AppError("SERVICE_UNAVAILABLE",503);
  if(authError||!identity.user||identity.user.is_anonymous)throw new AppError("AUTH_REQUIRED",401);
  const {data,error}=await client.rpc(rpc,{request});
  if(error){if(["40001","40P01"].includes(error.code)&&attempt<2)continue;throw mapDatabaseError(error);}
  const parsed=schema.safeParse(data);if(!parsed.success)throw new AppError("SERVICE_UNAVAILABLE",503);return parsed.data;
 }
 throw new AppError("SERVICE_UNAVAILABLE",503);
}

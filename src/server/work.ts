import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError,mapDatabaseError } from "@/lib/errors";
import { workReadSchema,workReceiptSchema,workEvidenceSchema,workListSchema,type WorkCommand } from "@/features/work/schema";
export async function workService(request:WorkCommand|{workId:string}|{evidenceId:string}|{cursor:string|null}) {
 const rpc="operation" in request?"work_command":"workId" in request?"read_work":"evidenceId" in request?"read_work_evidence":"list_work";
 const schema=rpc==="work_command"?workReceiptSchema:rpc==="read_work"?workReadSchema:rpc==="read_work_evidence"?workEvidenceSchema:workListSchema;
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

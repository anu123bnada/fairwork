import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError,mapDatabaseError } from "@/lib/errors";
import { caseReceiptSchema,caseReadSchema,caseListSchema,type CaseCommand } from "@/features/cases/schema";
export async function workCaseService(request:CaseCommand|{caseId:string}|{cursor:string|null;workId:string|null}) {
 const rpc="operation" in request?"work_case_command":"caseId" in request?"read_work_case":"list_work_cases";
 const schema=rpc==="work_case_command"?caseReceiptSchema:rpc==="read_work_case"?caseReadSchema:caseListSchema;
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

import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { workflowReadSchema, workflowReceiptSchema, type WorkflowCommand } from "@/features/offer/workflow-schema";

export async function agreementWorkflow(request: WorkflowCommand | { agreementId:string }) {
  const command = "operation" in request;
  // PostgreSQL aborts the entire transaction on serialization/deadlock failure.
  // Retain the same idempotency key and reauthenticate every bounded retry.
  for (let attempt=0; attempt<3; attempt++) {
    const client=await createServerSupabase(true);
    const {data:identity,error:authError}=await client.auth.getUser();
    if(authError && (authError.status??0)>=500) throw new AppError("SERVICE_UNAVAILABLE",503);
    if(authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED",401);
    const {data,error}=await client.rpc(command?"agreement_workflow":"read_agreement_workflow",{request});
    if(error){
      if(["40001","40P01"].includes(error.code) && attempt<2) continue;
      throw mapDatabaseError(error);
    }
    const parsed=(command?workflowReceiptSchema:workflowReadSchema).safeParse(data);
    if(!parsed.success) throw new AppError("SERVICE_UNAVAILABLE",503);
    return parsed.data;
  }
  throw new AppError("SERVICE_UNAVAILABLE",503);
}

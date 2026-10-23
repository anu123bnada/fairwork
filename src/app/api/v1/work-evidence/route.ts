import { z } from "zod";
import { apiResponse } from "@/server/http";
import { workService } from "@/server/work";
import { AppError } from "@/lib/errors";
export const dynamic="force-dynamic";
export async function GET(request:Request){return apiResponse(async()=>{
 const query=new URL(request.url).searchParams;const parsed=z.strictObject({evidenceId:z.uuid()}).safeParse(Object.fromEntries(query));
 if(!parsed.success||[...query.keys()].length!==1)throw new AppError("VALIDATION_FAILED",422);return workService(parsed.data);
},"work-evidence.v1");}

import {adminQuery,adminCommand} from "@/features/admin/schema";
import {adminService,adminRuntime} from "@/server/admin";
import {apiResponse,assertSameOrigin,idempotencyKey,readJson} from "@/server/http";
import {AppError} from "@/lib/errors";
export const dynamic="force-dynamic";
export async function GET(request:Request){return apiResponse(async()=>{const query=new URL(request.url).searchParams;if(new Set(query.keys()).size!==query.size)throw new AppError("VALIDATION_FAILED",422);const parsed=adminQuery.safeParse(Object.fromEntries(query));if(!parsed.success)throw new AppError("VALIDATION_FAILED",422);const data=await adminService("admin_read",parsed.data);return {...data,runtime:adminRuntime()};},"admin.v1");}
export async function POST(request:Request){return apiResponse(async()=>{assertSameOrigin(request);return adminService("admin_command",{...await readJson(request,adminCommand),idempotencyKey:idempotencyKey(request)});},"admin.v1");}

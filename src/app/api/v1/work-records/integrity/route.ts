import { apiResponse,assertSameOrigin,readJson } from "@/server/http";
import { integrityCommandSchema } from "@/features/work/integrity-schema";
import { workIntegrityService } from "@/server/work-integrity";
export const dynamic="force-dynamic";
export async function POST(request:Request){return apiResponse(async()=>{assertSameOrigin(request);return workIntegrityService(await readJson(request,integrityCommandSchema));},"work-integrity.v1");}

import {adminExportLog as exportLogSchema} from "@/features/admin/schema";
import {adminExportLog} from "@/server/admin";
import {apiResponse,assertSameOrigin,readJson} from "@/server/http";
export const dynamic="force-dynamic";
// Writes one audit entry for an export of administrative records. The body carries no exported records, only counts, names and a checksum.
export async function POST(request:Request){return apiResponse(async()=>{assertSameOrigin(request);return adminExportLog(await readJson(request,exportLogSchema));},"admin.v1");}

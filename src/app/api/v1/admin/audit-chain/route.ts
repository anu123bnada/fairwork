import {adminAuditChain} from "@/server/admin";
import {apiResponse} from "@/server/http";
export const dynamic="force-dynamic";
// Verifies the cross-record audit hash chain. Read-only; the database re-checks the administrator and a fresh second factor.
export async function GET(){return apiResponse(async()=>adminAuditChain(),"admin.v1");}

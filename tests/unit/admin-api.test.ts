import {beforeEach,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({service:vi.fn(),runtime:vi.fn(()=>({provider:"gemini",liveProcessingConfigured:false}))}));
vi.mock("@/server/admin",()=>({adminService:mocks.service,adminRuntime:mocks.runtime}));
import {GET,POST} from "@/app/api/v1/admin/route";
import {AppError} from "@/lib/errors";
beforeEach(()=>{vi.clearAllMocks();mocks.service.mockRejectedValue(new AppError("ACTION_FORBIDDEN",403));});
it("fails closed on database denial and duplicate or forged filters",async()=>{
 expect((await GET(new Request("http://localhost/api/v1/admin?from=2026-10-01&to=2026-10-31"))).status).toBe(403);expect(mocks.runtime).not.toHaveBeenCalled();
 for(const tail of ["&role=owner","&resource=users&resource=audit","&cursor=invalid"])expect((await GET(new Request(`http://localhost/api/v1/admin?from=2026-10-01&to=2026-10-31${tail}`))).status).toBe(422);
});
it("rejects cross-origin commands and client-supplied trusted identity",async()=>{
 const body={operation:"restrict",targetId:crypto.randomUUID(),expectedRevision:1,restricted:true,reason:"Test restriction reason",actorId:crypto.randomUUID()};
 for(const origin of ["https://foreign.test","http://localhost:3000"]){const response=await POST(new Request("http://localhost/api/v1/admin",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify(body)}));expect(response.status).toBe(origin.includes("foreign")?403:422);}
 expect(mocks.service).not.toHaveBeenCalled();
});

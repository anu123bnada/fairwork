import { beforeEach,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({getUser:vi.fn(),signOut:vi.fn(),rpc:vi.fn()}));
vi.mock("@/server/supabase",()=>({createServerSupabase:async()=>({auth:m,rpc:m.rpc})}));
import { POST } from "@/app/api/v1/auth/deactivate/route";
const request=(extra:object={})=>new Request("http://localhost:3000/api/v1/auth/deactivate",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify({expectedRevision:1,confirmation:"DEACTIVATE",...extra})});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("APP_ORIGIN","http://localhost:3000");m.getUser.mockResolvedValue({data:{user:{id:crypto.randomUUID()}},error:null});m.rpc.mockResolvedValue({data:{deactivated:true,recordedAt:"2026-10-18T00:00:00Z",revision:2},error:null});m.signOut.mockResolvedValue({error:null});});
it("rejects forged subject and missing confirmation before any mutation",async()=>{
 expect((await POST(request({subjectId:crypto.randomUUID()}))).status).toBe(422);
 expect((await POST(request({confirmation:"yes"}))).status).toBe(422);expect(m.rpc).not.toHaveBeenCalled();
});
it("denies anonymous and lower-assurance users without logging out a valid account",async()=>{
 m.getUser.mockResolvedValueOnce({data:{user:null},error:null});expect((await POST(request())).status).toBe(401);
 m.rpc.mockResolvedValueOnce({data:null,error:{message:"MFA_REQUIRED"}});expect((await POST(request())).status).toBe(403);expect(m.signOut).not.toHaveBeenCalled();
});
it("globally revokes sessions only after the persistent command succeeds",async()=>{
 const r=await POST(request());expect(r.status).toBe(200);expect((await r.json()).data.sessionsRevoked).toBe(true);expect(m.signOut).toHaveBeenCalledWith({scope:"global"});
});
it("truthfully reports committed deactivation when external session revocation fails",async()=>{
 m.signOut.mockRejectedValue(new Error("sensitive provider detail"));const r=await POST(request());
 expect(r.status).toBe(200);expect((await r.json()).data).toMatchObject({deactivated:true,sessionsRevoked:false});
});

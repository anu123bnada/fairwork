import {beforeEach,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn()}));
vi.mock("@/server/supabase",()=>({createServerSupabase:async()=>({auth:{getUser:mocks.user},rpc:mocks.rpc})}));
import {POST} from "@/app/api/v1/organizations/appeals/route";
const parent="50000000-0000-4000-8000-000000000001",child="50000000-0000-4000-8000-000000000002";
const body={requestId:parent,grounds:"Corrected synthetic authority evidence"};
function request(input:unknown=body,origin="http://localhost:3000"){return new Request("http://localhost:3000/api/v1/organizations/appeals",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json","Idempotency-Key":child},body:JSON.stringify(input)});}
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:{id:child}},error:null});mocks.rpc.mockResolvedValue({data:{requestId:child,parentRequestId:parent},error:null});});
it("rejects cross-origin, forged identity and anonymous requests before the command",async()=>{
 expect((await POST(request(body,"https://foreign.test"))).status).toBe(403);
 expect((await POST(request({...body,actorId:child}))).status).toBe(422);
 mocks.user.mockResolvedValue({data:{user:null},error:null});expect((await POST(request())).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
});
it("uses authenticated RPC identity, preserves idempotency and fails closed on database denial",async()=>{
 expect((await POST(request())).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith("appeal_organization_request",{request:{...body,idempotencyKey:child}});
 mocks.rpc.mockResolvedValue({error:{message:"ACTION_FORBIDDEN"},data:null});expect((await POST(request())).status).toBe(403);
 mocks.rpc.mockResolvedValue({error:null,data:{requestId:child}});expect((await POST(request())).status).toBe(503);
});

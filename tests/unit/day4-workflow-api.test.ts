import { beforeEach, describe, expect, it, vi } from "vitest";
import { workflowCommandSchema } from "@/features/offer/workflow-schema";
import { participantDestination, participantWorkflowId } from "@/features/offer/participant-path";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("@/server/supabase",()=>({createServerSupabase:vi.fn(async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc}))}));
import { GET, POST } from "@/app/api/v1/agreement-workflows/route";
const id="40000000-0000-4000-8000-000000000001";
const hash="a".repeat(64);
const input={operation:"acknowledge",agreementId:id,idempotencyKey:id,expectedVersion:1,expectedHash:hash,expectedState:"proposed",expectedItemSetHash:hash,acknowledgedItemIds:[id]};
const receipt={agreementId:id,version:1,contentHash:hash,state:"proposed",actorId:id,operation:"acknowledge",recordedAt:"2026-10-14T01:00:00+00:00"};
function post(body:unknown,origin="http://localhost:3000") {return POST(new Request("http://localhost:3000/api/v1/agreement-workflows",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)}));}
beforeEach(()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id,is_anonymous:false}},error:null});mocks.rpc.mockResolvedValue({data:receipt,error:null});});
describe("Day 4 API boundary",()=>{
 it("rejects forged actors, unknown operations, duplicates, missing optimistic guards and excessive IDs",async()=>{
   for(const invalid of [{...input,actorId:id},{...input,workerId:id},{...input,operation:"execute_sql"},{...input,expectedHash:undefined},{...input,acknowledgedItemIds:[id,id]},{...input,acknowledgedItemIds:Array(101).fill(id)}]){
     expect(workflowCommandSchema.safeParse(invalid).success).toBe(false);expect((await post(invalid)).status).toBe(422);
   }
   expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("retains CSRF and session checks and does not cache consent receipts",async()=>{
   expect((await post(input,"https://foreign.invalid")).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
   mocks.getUser.mockResolvedValueOnce({data:{user:null},error:null});expect((await post(input)).status).toBe(401);
   const response=await post(input);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
   expect(mocks.rpc).toHaveBeenCalledWith("agreement_workflow",{request:input});
 });
 it("validates read IDs and fails closed on unexpected projection fields",async()=>{
   for(const query of ["",`agreementId=${id}&agreementId=${id}`,`agreementId=${id}&workerId=${id}`])expect((await GET(new Request(`http://localhost/api/v1/agreement-workflows?${query}`))).status).toBe(422);
   mocks.rpc.mockResolvedValue({data:{...receipt,privateSource:"secret"},error:null});
   const response=await post(input);expect(response.status).toBe(503);expect(await response.text()).not.toContain("secret");
 });
 it("reauthenticates bounded database retries with the exact request key",async()=>{
   mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"40P01"}}).mockResolvedValueOnce({data:null,error:{code:"40001"}});
   expect((await post(input)).status).toBe(200);expect(mocks.getUser).toHaveBeenCalledTimes(3);expect(mocks.rpc).toHaveBeenCalledTimes(3);
   for(const call of mocks.rpc.mock.calls)expect(call[1]).toEqual({request:input});
 });
 it("maps authority and MFA refusals without provider detail",async()=>{
   mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"MFA_REQUIRED"}});expect((await post(input)).status).toBe(403);
   mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"VERSION_CONFLICT"}});expect((await post(input)).status).toBe(409);
 });
 it("carries only bounded workflow identifiers across sign-in",()=>{
   expect(participantDestination(`?workflowId=${id}&next=https://foreign.invalid`)).toBe(`/app/agreement-workflow?workflowId=${id}`);
   expect(participantWorkflowId(`?workflowId=${id}&workflowId=${id}`)).toBeNull();
   expect(participantDestination("?workflowId=//foreign.invalid")).toBeNull();
 });
});

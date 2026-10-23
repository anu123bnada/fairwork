import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("@/server/supabase",()=>({createServerSupabase:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
import {GET} from "@/app/api/v1/offers/assessment/route";
const id="40000000-0000-4000-8000-000000000001";
const read={offer:{offerId:id,companyId:id,workerId:id,representativeId:null,requesterId:id,requesterRole:"WORKER",version:3,termHash:"a".repeat(64),snapshot:{salary:80000,currency:"LKR"},changes:[],unresolved:[]},agreementId:id,confirmation:null,answers:[],canConfirm:false};
const request=(query=`offerId=${id}`)=>new Request(`http://127.0.0.1:3100/api/v1/offers/assessment?${query}`);
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("FAIRWORK_DATA_MODE","synthetic");mocks.getUser.mockResolvedValue({data:{user:{id}},error:null});mocks.rpc.mockResolvedValue({data:read,error:null});});
afterEach(()=>vi.unstubAllEnvs());
it("assesses only the authorized persisted revision and keeps output uncached",async()=>{
 const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
 expect((await response.json()).data).toMatchObject({offerId:id,offerVersion:3,termHash:"a".repeat(64),assessment:{score:10,version:"offer-indicators.v1"}});
 expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_agreement",{request:{offerId:id}});
});
it("denies anonymous and unauthenticated access before database assessment",async()=>{
 for(const user of [null,{id,is_anonymous:true}]){mocks.getUser.mockResolvedValue({data:{user},error:null});expect((await GET(request())).status).toBe(401);}
 expect(mocks.rpc).not.toHaveBeenCalled();
});
it("preserves database participant denial without disclosing terms",async()=>{
 mocks.rpc.mockResolvedValue({data:null,error:{message:"ACTION_FORBIDDEN"}});
 const result=await GET(request());expect(result.status).toBe(403);expect(JSON.stringify(await result.json())).not.toContain("80000");
});
it.each([`offerId=${id}&score=100`,`offerId=${id}&offerId=${id}`,`offerId=${id}&workerId=${id}`,"offerId=invalid"])("rejects untrusted assessment inputs: %s",async query=>{
 expect((await GET(request(query))).status).toBe(422);expect(mocks.rpc).not.toHaveBeenCalled();
});
it("fails closed if the backend returns a different offer",async()=>{
 mocks.rpc.mockResolvedValue({data:{...read,offer:{...read.offer,offerId:"40000000-0000-4000-8000-000000000002"}},error:null});
 expect((await GET(request())).status).toBe(503);
});

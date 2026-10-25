import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("@/server/supabase",()=>({createServerSupabase:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
import {GET,POST} from "@/app/api/v1/me/employment-history/route";
const url="http://localhost:3000/api/v1/me/employment-history";
const content={employer:"Synthetic Works Ltd",role:"Technician",startDate:"2021-03",endDate:null,current:true,skills:[],achievements:""};
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("APP_ORIGIN","http://localhost:3000");mocks.getUser.mockResolvedValue({data:{user:{id:crypto.randomUUID()}},error:null});mocks.rpc.mockResolvedValue({data:{items:[],nextCursor:null},error:null});});
afterEach(()=>vi.unstubAllEnvs());
it("rejects identity injection and invalid cursors before reading",async()=>{
 for(const query of ["?actorId=forged","?cursor=bad","?cursor=x&cursor=y"])expect((await GET(new Request(`${url}${query}`))).status).toBe(422);
 expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires authentication and private responses",async()=>{
 expect((await GET(new Request(url))).headers.get("cache-control")).toBe("private, no-store");
 mocks.getUser.mockResolvedValue({data:{user:null},error:null});expect((await GET(new Request(url))).status).toBe(401);
});
it("requires same origin and refuses fabricated verification or inconsistent dates",async()=>{
 const body={operation:"save",id:crypto.randomUUID(),expectedRevision:0,idempotencyKey:crypto.randomUUID(),content};
 const req=(origin:string,value:unknown)=>new Request(url,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(value)});
 expect((await POST(req("https://other.test",body))).status).toBe(403);
 expect((await POST(req("http://localhost:3000",{...body,content:{...content,verified:true}}))).status).toBe(422);
 expect((await POST(req("http://localhost:3000",{...body,content:{...content,current:false,endDate:"2020-01"}}))).status).toBe(422);
 expect(mocks.rpc).not.toHaveBeenCalled();
 mocks.rpc.mockResolvedValue({data:{id:body.id,revision:1,saved:true},error:null});expect((await POST(req("http://localhost:3000",body))).status).toBe(200);
 expect(mocks.rpc).toHaveBeenCalledWith("employment_history",{request:body});
});

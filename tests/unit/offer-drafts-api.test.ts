import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("@/server/supabase",()=>({createServerSupabase:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
import {GET,POST} from "@/app/api/v1/offers/drafts/route";
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("APP_ORIGIN","http://localhost:3000");mocks.getUser.mockResolvedValue({data:{user:{id:crypto.randomUUID()}},error:null});mocks.rpc.mockResolvedValue({data:{items:[],nextCursor:null},error:null});});
afterEach(()=>vi.unstubAllEnvs());
it("rejects identity injection and invalid cursors before reading",async()=>{
 for(const query of ["?actorId=forged","?cursor=bad","?cursor=x&cursor=y"])expect((await GET(new Request(`http://localhost:3000/api/v1/offers/drafts${query}`))).status).toBe(422);
 expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires authentication and private responses",async()=>{
 const request=new Request("http://localhost:3000/api/v1/offers/drafts");
 expect((await GET(request)).headers.get("cache-control")).toBe("private, no-store");
 mocks.getUser.mockResolvedValue({data:{user:null},error:null});expect((await GET(request)).status).toBe(401);
});
it("requires same origin for saving and refuses fabricated provider fields",async()=>{
 const body={operation:"save",id:crypto.randomUUID(),expectedRevision:0,idempotencyKey:crypto.randomUUID(),content:{role:"Worker",employer:"",text:""}};
 const request=(origin:string,value:unknown)=>new Request("http://localhost:3000/api/v1/offers/drafts",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(value)});
 expect((await POST(request("https://other.test",body))).status).toBe(403);
 expect((await POST(request("http://localhost:3000",{...body,verified:true}))).status).toBe(422);
 mocks.rpc.mockResolvedValue({data:{id:body.id,revision:1,saved:true},error:null});expect((await POST(request("http://localhost:3000",body))).status).toBe(200);
 expect(mocks.rpc).toHaveBeenCalledWith("offer_drafts",{request:body});
});

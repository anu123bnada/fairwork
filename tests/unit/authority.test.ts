import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),listFactors:vi.fn(),enroll:vi.fn(),challenge:vi.fn(),verify:vi.fn()}));
vi.mock("@/server/supabase",()=>({createServerSupabase:vi.fn(async()=>({auth:{getUser:mocks.getUser,mfa:mocks},rpc:mocks.rpc}))}));
import { POST as company } from "@/app/api/v1/operator/companies/route";
import { POST as membership } from "@/app/api/v1/operator/membership-decisions/route";
import { POST as mfa, GET as factors } from "@/app/api/v1/auth/mfa/route";
const A="40000000-0000-4000-8000-000000000001";
const request=(body:unknown,origin="http://localhost:3000")=>new Request("http://localhost:3000/api/v1/operator/companies",{method:"POST",headers:{origin,"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("APP_ORIGIN","http://localhost:3000");mocks.getUser.mockResolvedValue({data:{user:{id:A,is_anonymous:false}},error:null});});
describe("Day 2 routes",()=>{
  it("blocks CSRF, actor injection and malformed membership input before database access",async()=>{
    expect((await company(request({name:"Synthetic"},"https://evil.example"))).status).toBe(403);
    expect((await company(request({name:"Synthetic",actorId:A}))).status).toBe(422);
    expect((await membership(request({subjectId:A,decision:"approve"}))).status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("uses verified auth and a strict DTO with a no-store authority envelope",async()=>{
    mocks.rpc.mockResolvedValue({data:{id:A,name:"Synthetic",identityLabel:"demo_provisioned",revision:1},error:null});
    const response=await company(request({name:"Synthetic"}));expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");expect((await response.json()).meta.schemaVersion).toBe("authority.v1");
    expect(mocks.rpc).toHaveBeenCalledWith("provision_company",{request:{name:"Synthetic",idempotencyKey:expect.any(String)}});
    mocks.rpc.mockResolvedValue({data:{id:A,name:"Synthetic",identityLabel:"demo_provisioned",revision:1,secret:"leak"},error:null});
    expect((await company(request({name:"Synthetic"}))).status).toBe(500);
  });
  it("rejects anonymous sessions and preserves database MFA/capability denials",async()=>{
    mocks.getUser.mockResolvedValue({data:{user:{id:A,is_anonymous:true}},error:null});
    expect((await company(request({name:"Synthetic"}))).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({data:{user:{id:A}},error:null});
    mocks.rpc.mockResolvedValue({error:{message:"MFA_REQUIRED"}});
    const response=await company(request({name:"Synthetic"}));expect(response.status).toBe(403);expect((await response.json()).error.code).toBe("MFA_REQUIRED");
  });
  it("does not enroll from GET or for cross-origin calls",async()=>{
    mocks.listFactors.mockResolvedValue({data:{totp:[{id:A,status:"verified",secret:"hidden"}]},error:null});
    const response=await factors(new Request("http://localhost:3000/api/v1/auth/mfa"));
    expect(await response.json()).toMatchObject({data:{factors:[{id:A,status:"verified"}]}});
    expect((await mfa(request({action:"enroll"},"https://evil.example"))).status).toBe(403);expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("enrolls only on explicit authenticated request and never replaces verified factors",async()=>{
    mocks.listFactors.mockResolvedValue({data:{totp:[]},error:null});
    mocks.enroll.mockResolvedValue({data:{id:A,totp:{secret:"SYNTHETIC_TEST_SEED"}},error:null});
    const response=await mfa(request({action:"enroll"}));expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual({factorId:A,secret:"SYNTHETIC_TEST_SEED"});
    mocks.listFactors.mockResolvedValue({data:{totp:[{id:A,status:"verified"}]},error:null});
    expect((await mfa(request({action:"enroll"}))).status).toBe(403);expect(mocks.enroll).toHaveBeenCalledTimes(1);
  });
  it("challenges the current user's factor and never serializes upgraded session tokens",async()=>{
    mocks.challenge.mockResolvedValue({data:{id:crypto.randomUUID()},error:null});
    mocks.verify.mockResolvedValue({data:{access_token:"SENSITIVE_TOKEN",refresh_token:"SENSITIVE_REFRESH"},error:null});
    const response=await mfa(request({action:"verify",factorId:A,code:"123456"}));
    expect(response.status).toBe(200);const text=await response.text();expect(text).toContain('"verified":true');expect(text).not.toContain("SENSITIVE");
    mocks.challenge.mockResolvedValue({data:null,error:{status:400,message:"Someone else's factor"}});
    const denied=await mfa(request({action:"verify",factorId:A,code:"123456"}));expect(denied.status).toBe(403);expect(await denied.text()).not.toContain("Someone");
  });
  it("rejects invalid TOTP input and reports provider throttling safely",async()=>{
    expect((await mfa(request({action:"verify",factorId:A,code:"1234"}))).status).toBe(422);expect(mocks.challenge).not.toHaveBeenCalled();
    mocks.challenge.mockResolvedValue({error:{status:429}});const response=await mfa(request({action:"verify",factorId:A,code:"123456"}));expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("60");
  });
});

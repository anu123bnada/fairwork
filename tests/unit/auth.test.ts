import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({signInWithPassword:vi.fn(),signOut:vi.fn(),getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("@/server/supabase",()=>({createServerSupabase:vi.fn(async()=>({auth:mocks,rpc:mocks.rpc}))}));
import { POST as signIn } from "@/app/api/v1/auth/sign-in/route";
import { POST as signOut } from "@/app/api/v1/auth/sign-out/route";
import { identityCommand } from "@/server/identity";

const request=(data:unknown)=>new Request("http://localhost:3000/api/v1/auth/sign-in",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify(data)});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("APP_ORIGIN","http://localhost:3000");mocks.rpc.mockResolvedValue({data:{access:"active"},error:null});mocks.signOut.mockResolvedValue({error:null});});
describe("Auth handlers and verified identity boundary",()=>{
  it("routes a verified account without a profile to profile completion",async()=>{
    mocks.signInWithPassword.mockResolvedValue({error:null});
    mocks.rpc.mockResolvedValueOnce({data:{access:"needs_profile"},error:null});
    const response=await signIn(request({email:"synthetic@example.test",password:"synthetic-only"}));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({signedIn:true,profileRequired:true});
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("never includes Supabase tokens in the successful response",async()=>{
    mocks.signInWithPassword.mockResolvedValue({error:null,data:{session:{access_token:"private-token"}}});
    const response=await signIn(request({email:"synthetic@example.test",password:"synthetic-only"}));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("private-token");
  });
  it("uses one generic response for credential failures and does not leak account existence",async()=>{
    mocks.signInWithPassword.mockResolvedValue({error:{status:400,message:"User email does not exist"}});
    const response=await signIn(request({email:"synthetic@example.test",password:"synthetic-only"}));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("email");
  });
  it("rejects disabled accounts and fails closed when the schema check is unavailable",async()=>{
    mocks.signInWithPassword.mockResolvedValue({error:null});
    mocks.rpc.mockResolvedValue({data:{access:"disabled"},error:null});
    expect((await signIn(request({email:"synthetic@example.test",password:"synthetic-only"}))).status).toBe(403);
    expect(mocks.signOut).toHaveBeenCalledWith({scope:"local"});
    mocks.rpc.mockResolvedValue({data:null,error:{message:"sensitive database error"}});
    const failure=await signIn(request({email:"synthetic@example.test",password:"synthetic-only"}));
    expect(failure.status).toBe(503);expect(await failure.text()).not.toContain("sensitive");
  });
  it("blocks body role injection before calling the auth provider",async()=>{
    expect((await signIn(request({email:"synthetic@example.test",password:"synthetic-only",role:"ADMIN"}))).status).toBe(422);
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
  it("clears the new session when the account access request throws",async()=>{
    mocks.signInWithPassword.mockResolvedValue({error:null});
    mocks.rpc.mockRejectedValueOnce(new Error("private transport diagnostic"));
    const response=await signIn(request({email:"synthetic@example.test",password:"synthetic-only"}));
    expect(mocks.signOut).toHaveBeenCalledWith({scope:"local"});
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private transport diagnostic");
  });
  it("reports unavailable when rejected sign-in session cleanup fails",async()=>{
    mocks.signInWithPassword.mockResolvedValue({error:null});
    mocks.rpc.mockResolvedValueOnce({data:{access:"disabled"},error:null});
    mocks.signOut.mockResolvedValueOnce({error:{status:500,message:"private logout diagnostic"}});
    const response=await signIn(request({email:"synthetic@example.test",password:"synthetic-only"}));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private logout diagnostic");
  });
  it("signs out only the current session with a same-origin JSON mutation",async()=>{
    mocks.getUser.mockResolvedValue({data:{user:{id:crypto.randomUUID()}},error:null});
    mocks.signOut.mockResolvedValue({error:null});
    expect((await signOut(request({}))).status).toBe(200);
    expect(mocks.signOut).toHaveBeenCalledWith({scope:"local"});
  });
  it("still clears the current session if the optional telemetry identity lookup fails",async()=>{
    mocks.getUser.mockRejectedValue(new Error("Auth temporarily unavailable"));
    expect((await signOut(request({}))).status).toBe(200);
    expect(mocks.signOut).toHaveBeenCalledWith({scope:"local"});
  });
  it("does not call profile RPCs for invalid or anonymous users",async()=>{
    mocks.getUser.mockResolvedValue({data:{user:null},error:{status:401}});
    await expect(identityCommand("get_me",{})).rejects.toMatchObject({code:"AUTH_REQUIRED"});
    mocks.getUser.mockResolvedValue({data:{user:{id:crypto.randomUUID(),is_anonymous:true}},error:null});
    await expect(identityCommand("get_me",{})).rejects.toMatchObject({code:"AUTH_REQUIRED"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

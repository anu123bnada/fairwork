import { describe, it, expect, vi } from "vitest";
import { readPublicEnvironment, validateServerEnvironment } from "@/lib/env";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { createProfileSchema, signInSchema, availableContexts } from "@/features/identity/schema";
import { assertSameOrigin, readJson, apiResponse } from "@/server/http";

describe("environment and trust boundaries", () => {
  it("boots without credentials but rejects partial, secret-key, remote HTTP and real-data config", () => {
    expect(readPublicEnvironment({})).toBeNull();
    const key="sb_publishable_synthetic_configuration_test";
    expect(readPublicEnvironment({url:"https://example.supabase.co",key})).toEqual({url:"https://example.supabase.co",key});
    for (const env of [{url:"https://example.supabase.co"},{url:"http://example.com",key},{url:"https://example.supabase.co",key:"sb_secret_never_expose_this"}]) expect(()=>readPublicEnvironment(env)).toThrow(AppError);
    expect(()=>validateServerEnvironment({dataMode:"production"})).toThrow(AppError);
    expect(()=>validateServerEnvironment({origin:"https://example.com/redirect"})).toThrow(AppError);
  });
  it("rejects forged role/actor fields and unknown time zones; password is not trimmed", () => {
    const profile={displayName:"Worker",locale:"en",timeZone:"Asia/Colombo"};
    expect(createProfileSchema.safeParse(profile).success).toBe(true);
    expect(createProfileSchema.safeParse({...profile,role:"ADMIN"}).success).toBe(false);
    expect(createProfileSchema.safeParse({...profile,timeZone:"Fake/Zone"}).success).toBe(false);
    expect(signInSchema.parse({email:"synthetic@example.test",password:" password "}).password).toBe(" password ");
    expect(availableContexts({id:crypto.randomUUID(),displayName:"Employer",locale:"en",timeZone:"UTC",revision:1,capabilities:[]})).toEqual(["WORKER"]);
  });
  it("rejects cross-origin/missing-Origin mutation requests", () => {
    vi.stubEnv("APP_ORIGIN","https://demo.example.test");
    expect(()=>assertSameOrigin(new Request("https://demo.example.test/api/v1/me",{headers:{origin:"https://evil.example"}}))).toThrow(AppError);
    expect(()=>assertSameOrigin(new Request("https://demo.example.test/api/v1/me"))).toThrow(AppError);
    expect(()=>assertSameOrigin(new Request("https://demo.example.test/api/v1/me",{headers:{origin:"https://demo.example.test"}}))).not.toThrow();
    vi.unstubAllEnvs();
  });
  it("enforces actual body bytes and strict JSON independently of Content-Length", async () => {
    const req=(body:string)=>new Request("http://localhost",{method:"POST",headers:{"content-type":"application/json"},body});
    await expect(readJson(req("{"),createProfileSchema)).rejects.toMatchObject({code:"INVALID_JSON"});
    await expect(readJson(req(JSON.stringify({displayName:"x".repeat(70000)})),createProfileSchema)).rejects.toMatchObject({code:"PAYLOAD_TOO_LARGE"});
    await expect(readJson(req(JSON.stringify({displayName:"A",locale:"en",timeZone:"UTC",account_state:"active"})),createProfileSchema)).rejects.toMatchObject({code:"VALIDATION_FAILED"});
  });
  it("returns safe no-store errors without exception/provider contents", async () => {
    const logger=vi.spyOn(console,"error").mockImplementation(()=>{});
    const response=await apiResponse(async()=>{throw new Error("secret-password and private SQL");});
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("secret-password");
    expect(JSON.stringify(logger.mock.calls)).not.toContain("private SQL");
    expect(mapDatabaseError({message:"private SQL"}).message).not.toContain("SQL");
    logger.mockRestore();
  });
});

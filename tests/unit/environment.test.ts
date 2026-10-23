import { afterEach, describe, expect, it, vi } from "vitest";
import { validateServerEnvironment } from "@/lib/env";

afterEach(()=>vi.unstubAllEnvs());
describe("Supabase deployment environment",()=>{
  it("accepts the deployed supabase mode with valid public configuration",()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","sb_publishable_synthetic_configuration_test");
    expect(validateServerEnvironment({origin:"https://app.example.test",dataMode:"supabase"})).toEqual({origin:"https://app.example.test",dataMode:"supabase"});
  });
  it("still fails closed for missing or secret credentials and malformed origins",()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","");vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","");
    expect(()=>validateServerEnvironment({dataMode:"supabase"})).toThrow();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","sb_secret_not_a_public_credential");
    expect(()=>validateServerEnvironment({dataMode:"supabase"})).toThrow();
    for(const origin of ["https://app.example.test/path","http://public.example.test","https://user:password@app.example.test"]){
      expect(()=>validateServerEnvironment({origin})).toThrow();
    }
  });
});

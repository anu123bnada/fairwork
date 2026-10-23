import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({query:vi.fn(),config:vi.fn(),on:vi.fn()}));
vi.mock("pg",()=>({Pool:class{constructor(config:unknown){mocks.config(config);}query=mocks.query;on=mocks.on;}}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.stubEnv("ORYQEN_TELEMETRY_DB_URL","");mocks.query.mockResolvedValue({rows:[]});});
afterEach(()=>vi.unstubAllEnvs());
const event=()=>({id:crypto.randomUUID(),kind:"login_failure" as const,operation:"auth.sign-in",code:"AUTH_REQUIRED" as const});
it("does not connect when disabled and rejects broad database credentials",async()=>{
 const {recordRuntimeEvent}=await import("@/server/telemetry");
 expect(await recordRuntimeEvent(event())).toBe(false);expect(mocks.config).not.toHaveBeenCalled();
 vi.stubEnv("ORYQEN_TELEMETRY_DB_URL","postgresql://postgres:synthetic@127.0.0.1:55422/postgres");
 expect(await recordRuntimeEvent(event())).toBe(false);expect(mocks.query).not.toHaveBeenCalled();
});
it("only writes parameterized allowlisted metadata and never emits credentials or error details",async()=>{
 vi.stubEnv("ORYQEN_TELEMETRY_DB_URL","postgresql://oryqen_telemetry_writer:synthetic@127.0.0.1:55422/postgres");
 const {recordRuntimeEvent,telemetryStatus}=await import("@/server/telemetry");
 const input=event();expect(await recordRuntimeEvent(input)).toBe(true);
 expect(mocks.query).toHaveBeenCalledWith("select runtime_ingest.record_event($1::jsonb)",[JSON.stringify(input)]);
 const log=vi.spyOn(console,"error").mockImplementation(()=>{});
 expect(await recordRuntimeEvent({...input,password:"must not be logged"} as typeof input)).toBe(false);
 mocks.query.mockRejectedValue(new Error("sensitive database URL"));expect(await recordRuntimeEvent(event())).toBe(false);
 expect(telemetryStatus().lastWrite).toBe("failed");expect(log).not.toHaveBeenCalled();log.mockRestore();
});
it("requires verified TLS for non-loopback configured ingestion",async()=>{
 vi.stubEnv("ORYQEN_TELEMETRY_DB_URL","postgresql://oryqen_telemetry_writer:synthetic@db.example.test/postgres");
 const {recordRuntimeEvent}=await import("@/server/telemetry");await recordRuntimeEvent(event());
 expect(mocks.config.mock.calls[0]![0]).toMatchObject({ssl:{rejectUnauthorized:true},max:2,connectionTimeoutMillis:700});
});

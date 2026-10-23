import "server-only";
import {Pool} from "pg";
import {z} from "zod";
import {errorMessages} from "@/lib/errors";

const eventSchema=z.strictObject({
 id:z.uuid(),kind:z.enum(["api_failure","login_success","login_failure","mfa_success","logout_success","password_changed","ai_attempt","ai_success","ai_error","ai_rate_limited","ai_unconfigured"]),
 operation:z.string().regex(/^[a-z0-9_.-]{1,64}$/),subjectId:z.uuid().optional(),authorizationId:z.uuid().optional(),
 code:z.enum(Object.keys(errorMessages) as [keyof typeof errorMessages,...(keyof typeof errorMessages)[]]).optional(),
 durationMs:z.number().int().min(0).max(120000).optional(),inputTokens:z.number().int().min(0).max(10000000).optional(),outputTokens:z.number().int().min(0).max(10000000).optional(),
});
export type RuntimeEvent=z.infer<typeof eventSchema>;
let pool:Pool|undefined;let active=0;let lastWrite:"not_observed"|"succeeded"|"failed"="not_observed";
export function telemetryStatus(){return {configured:Boolean(process.env.ORYQEN_TELEMETRY_DB_URL),lastWrite,coverage:"server_observed_events_only",cost:"unavailable_without_account_pricing"};}
function writer(){
 if(pool)return pool;
 const raw=process.env.ORYQEN_TELEMETRY_DB_URL;if(!raw)return null;
 const url=new URL(raw);
 if(!["postgres:","postgresql:"].includes(url.protocol)||decodeURIComponent(url.username)!=="oryqen_telemetry_writer"||!url.password||url.search||url.hash)throw new Error("Invalid telemetry configuration");
 const loopback=["127.0.0.1","localhost","[::1]"].includes(url.hostname);
 pool=new Pool({connectionString:raw,ssl:loopback?false:{rejectUnauthorized:true},max:2,connectionTimeoutMillis:700,idleTimeoutMillis:10000,statement_timeout:1000,query_timeout:1500,application_name:"oryqen_telemetry"});
 pool.on("error",()=>{lastWrite="failed";});return pool;
}
// Never accept request bodies or arbitrary provider errors. A telemetry failure
// must not turn an already committed business command into a false API failure.
export async function recordRuntimeEvent(event:RuntimeEvent):Promise<boolean>{
 if(!process.env.ORYQEN_TELEMETRY_DB_URL)return false;
 if(active>=4){lastWrite="failed";return false;}
 active++;
 try{
  const parsed=eventSchema.parse(event),client=writer();if(!client)return false;
  await client.query("select runtime_ingest.record_event($1::jsonb)",[JSON.stringify(parsed)]);
  lastWrite="succeeded";return true;
 }catch{lastWrite="failed";return false;}finally{active--;}
}

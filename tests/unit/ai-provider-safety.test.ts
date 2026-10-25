import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { executeAiOfferAnalysis, toGeminiResponseSchema } from "@/server/ai/provider";
import { authorizeAiTransmission } from "@/server/ai/consent";
import { aiConfiguration } from "@/server/ai/config";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { z } from "zod";
import { aiOfferAnalysisDataSchema } from "@/features/offer/ai-schema";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ rpc: mocks.rpc }) }));
const source = "Role: Technician\nSalary: LKR 80000 monthly\n40 hours per week";
it.each(["gemini", "openai"])("%s rejects invented numbers even with genuine source quotations", async provider => {
 vi.stubEnv("ORYQEN_AI_PROVIDER", provider);
 for (const field of ["salary", "hours"] as const) {
  const fixture = extractOfferTermsRuleBased(source).data!;
  if (field === "salary") fixture.salary.amount = 8000;
  else fixture.workingHours.hoursPerWeek = 4;
  const content = JSON.stringify(fixture);
  const envelope = provider === "gemini" ? { candidates: [{ finishReason: "STOP", content: { parts: [{ text: content }] } }] } : { choices: [{ finish_reason: "stop", message: { content } }] };
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(envelope));
  const result = await executeAiOfferAnalysis(source);
  expect(result.status).toBe("ERROR"); expect(result.data).toBeNull();
 }
});
it("accepts a comma-grouped amount supported by the exact source", async () => {
 const quoted = source.replace("80000", "80,000");
 const fixture = extractOfferTermsRuleBased(source).data!;
 fixture.salary.quote = "Salary: LKR 80,000 monthly";
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(fixture) } }] }));
 expect((await executeAiOfferAnalysis(quoted)).status).toBe("SUCCESS");
});
beforeEach(() => {
 vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn());
 vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key"); vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
 vi.stubEnv("ORYQEN_AI_ENABLED", "true"); vi.stubEnv("ORYQEN_AI_PROVIDER", "openai");
 vi.stubEnv("GEMINI_MODEL", "gemini-synthetic-test");
 vi.stubEnv("ORYQEN_AI_POLICY_APPROVED", "true");vi.stubEnv("ORYQEN_AI_POLICY_APPROVAL_REF", "synthetic-test-approval-only");
 vi.stubEnv("ORYQEN_AI_PROCESSING_REGION", "Synthetic test region"); vi.stubEnv("ORYQEN_AI_DATA_USE", "Test policy; no real transmission");
 mocks.rpc.mockResolvedValue({ error: null, data: { authorizationId: crypto.randomUUID() } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("requires explicit server enablement even when credentials exist", async () => {
 vi.stubEnv("ORYQEN_AI_ENABLED", "false");
 expect((await executeAiOfferAnalysis(source)).status).toBe("UNCONFIGURED"); expect(fetch).not.toHaveBeenCalled();
});
it("requires documented owner policy approval and a safe explicit Gemini model",async()=>{
 vi.stubEnv("ORYQEN_AI_POLICY_APPROVED","false");expect((await executeAiOfferAnalysis(source)).status).toBe("UNCONFIGURED");
 vi.stubEnv("ORYQEN_AI_POLICY_APPROVED","true");vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");vi.stubEnv("GEMINI_MODEL","");expect(aiConfiguration()).toBeNull();
 vi.stubEnv("GEMINI_MODEL","../other-service?key=x");expect(aiConfiguration()).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
it("treats provider keys as opaque credentials instead of enforcing a legacy prefix",()=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");
 vi.stubEnv("GEMINI_API_KEY","AQ.fictional-key-not-for-network.testing-only");
 expect(aiConfiguration()).not.toBeNull();expect(fetch).not.toHaveBeenCalled();
});
it("reports provider 404 without asserting the credential or account is invalid",async()=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");
 vi.mocked(fetch).mockResolvedValue(new Response("sensitive provider diagnostic",{status:404}));
 const result=await executeAiOfferAnalysis(source);
 expect(result.status).toBe("ERROR");expect(result.message).toContain("model or resource");
 expect(result.message).not.toContain("unavailable to this account");expect(JSON.stringify(result)).not.toContain("sensitive provider diagnostic");expect(fetch).toHaveBeenCalledTimes(1);
});
it("Gemini transmits only the redacted preview to one configured model with structured output",async()=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");
 const fixture=extractOfferTermsRuleBased(source).data;
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(fixture)}]}}]})));
 const result=await executeAiOfferAnalysis(`Name: Synthetic Private Person\nEmail: private@example.test\n${source}`);
 expect(result.status).toBe("SUCCESS");expect(fetch).toHaveBeenCalledTimes(1);
 const [url,init]=vi.mocked(fetch).mock.calls[0]!;
 expect(String(url)).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-synthetic-test:generateContent");
 const body=JSON.parse(init?.body as string);
 expect(init?.body).not.toContain("Synthetic Private Person");expect(init?.body).not.toContain("private@example.test");
 expect(body.generationConfig.responseMimeType).toBe("application/json");expect(body.generationConfig.responseFormat).toBeUndefined();
 expect(body.generationConfig.responseJsonSchema.properties.salary).toBeDefined();expect(body.tools).toBeUndefined();
  expect(body.generationConfig).toEqual({responseMimeType:"application/json",responseJsonSchema:toGeminiResponseSchema(z.toJSONSchema(aiOfferAnalysisDataSchema)),temperature:0.1,candidateCount:1,maxOutputTokens:3000});
  const schema=body.generationConfig.responseJsonSchema;
  // Keywords the live API rejected with HTTP 400 must not be sent; the same limits are enforced by Zod on the response.
  const keywords=new Set<string>();(function walk(node:unknown){if(Array.isArray(node))node.forEach(walk);else if(node&&typeof node==="object")for(const [key,value] of Object.entries(node)){keywords.add(key);walk(value);}})(schema);
  for(const banned of ["$schema","exclusiveMinimum","exclusiveMaximum","minLength","maxLength","pattern","minItems","maxItems"])expect(keywords.has(banned)).toBe(false);
  expect(schema.properties.salary.properties.amount.anyOf[0]).toEqual({type:"number"});
  expect(schema.properties.warningSigns.items.properties.id).toEqual({type:"string"});
  expect(schema.additionalProperties).toBe(false);expect(schema.properties.warningSigns.maxItems).toBeUndefined();
  expect(()=>aiOfferAnalysisDataSchema.parse({...fixture,warningSigns:Array.from({length:13},(_,i)=>({id:`w${i}`,severity:"low",title:"t",description:"d",quote:null,recommendation:"r"}))})).toThrow();
  expect(()=>aiOfferAnalysisDataSchema.parse({...fixture,salary:{...fixture.salary,amount:-1,quote:"x"}})).toThrow();
  expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("synthetic-test-key");
 expect(body.cachedContent).toBeUndefined();expect(body.generationConfig.maxOutputTokens).toBe(3000);
 expect(init?.redirect).toBe("error");expect(init?.cache).toBe("no-store");
 expect(init?.signal).toBeInstanceOf(AbortSignal);
});
it.each(["gemini", "openai"])("%s rejects redirects, timeouts and malformed output without exposing private content", async provider => {
 vi.stubEnv("ORYQEN_AI_PROVIDER", provider);
 vi.mocked(fetch).mockResolvedValueOnce(new Response(null, {status: 307, headers: {location: "https://unapproved.example"}}));
 expect((await executeAiOfferAnalysis(source)).status).toBe("ERROR");
 const init = vi.mocked(fetch).mock.calls[0]![1];
 expect(init?.redirect).toBe("error");expect(init?.cache).toBe("no-store");
 vi.mocked(fetch).mockRejectedValueOnce(new DOMException("private provider content", "TimeoutError"));
 const timeout = await executeAiOfferAnalysis(source);
 expect(timeout.status).toBe("ERROR");expect(JSON.stringify(timeout)).not.toContain("private provider content");
 vi.mocked(fetch).mockResolvedValueOnce(new Response("private malformed content", {status:200}));
 const invalid = await executeAiOfferAnalysis(source);
 expect(invalid.status).toBe("ERROR");expect(JSON.stringify(invalid)).not.toContain("private malformed content");
 expect(fetch).toHaveBeenCalledTimes(3);
});
it.each(["MAX_TOKENS", "SAFETY", "RECITATION", ""])("rejects unfinished or blocked Gemini output (%s)", async finishReason => {
 vi.stubEnv("ORYQEN_AI_PROVIDER", "gemini");
 const fixture=extractOfferTermsRuleBased(source).data;
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason,content:{parts:[{text:JSON.stringify(fixture)}]}}]})));
 const result=await executeAiOfferAnalysis(source);
 expect(result.status).toBe("ERROR");expect(result.data).toBeNull();expect(fetch).toHaveBeenCalledTimes(1);
});
it("accepts complete Gemini text parts while excluding thought content",async()=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");
 const json=JSON.stringify(extractOfferTermsRuleBased(source).data);
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{thought:true,text:"private thought"},{text:json.slice(0,50)},{text:json.slice(50)}]}}]})));
 expect((await executeAiOfferAnalysis(source)).status).toBe("SUCCESS");
});
it.each(["gemini","openai"])("%s reports rejected credentials without exposing provider diagnostics",async provider=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER",provider);
 vi.mocked(fetch).mockResolvedValue(new Response("sensitive diagnostic",{status:401}));
 const result=await executeAiOfferAnalysis(source);
 expect(result.status).toBe("ERROR");expect(result.message).toContain("credentials");
 expect(JSON.stringify(result)).not.toContain("sensitive diagnostic");expect(fetch).toHaveBeenCalledTimes(1);
});
it("requires consent to the selected provider and a durable budget admission", async () => {
 await expect(authorizeAiTransmission({ text: source, role: "WORKER" })).rejects.toMatchObject({ code: "ACTION_FORBIDDEN" });
 await expect(authorizeAiTransmission({ text: source, role: "WORKER", consent: { provider: "gemini", noticeVersion: "offer-analysis.v1", transmit: true, policyHash: aiConfiguration()!.policyHash } })).rejects.toMatchObject({ code: "ACTION_FORBIDDEN" });
 expect(mocks.rpc).not.toHaveBeenCalled();
 await authorizeAiTransmission({ text: source, role: "WORKER", consent: { provider: "openai", noticeVersion: "offer-analysis.v1", transmit: true, policyHash: aiConfiguration()!.policyHash } });
 const transmitted = JSON.stringify(mocks.rpc.mock.calls);
 expect(transmitted).not.toContain(source); expect(transmitted).toContain("inputHash");
 mocks.rpc.mockResolvedValue({ error: { message: "RATE_LIMITED" } });
 await expect(authorizeAiTransmission({ text: source, role: "WORKER", consent: { provider: "openai", noticeVersion: "offer-analysis.v1", transmit: true, policyHash: aiConfiguration()!.policyHash } })).rejects.toMatchObject({ code: "RATE_LIMITED" });
});
it("fails closed for incomplete disclosure or stale consent policy", async () => {
 const oldHash = aiConfiguration()!.policyHash;
 vi.stubEnv("ORYQEN_AI_PROCESSING_REGION", "Changed test region");
 await expect(authorizeAiTransmission({ text: source, role: "WORKER", consent: { provider: "openai", noticeVersion: "offer-analysis.v1", transmit: true, policyHash: oldHash } })).rejects.toMatchObject({ code: "ACTION_FORBIDDEN" });
 vi.stubEnv("ORYQEN_AI_DATA_USE", "");
 expect((await executeAiOfferAnalysis(source)).status).toBe("UNCONFIGURED");
 expect(fetch).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("never falls back to a second provider or leaks failure content", async () => {
 vi.stubEnv("ORYQEN_AI_PROVIDER", "gemini");
 vi.mocked(fetch).mockResolvedValue(new Response("sensitive-provider-body", { status: 429 }));
 const result = await executeAiOfferAnalysis(source);
 expect(result.status).toBe("RATE_LIMITED"); expect(fetch).toHaveBeenCalledTimes(1);
 expect(JSON.stringify(result)).not.toContain("sensitive-provider-body");
 expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).not.toContain("synthetic-test-key");
});
it("validates provider schema and exact quotations; fixes authoritative disclaimer", async () => {
 const fixture = extractOfferTermsRuleBased(source).data;
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(fixture) } }] })));
 const result = await executeAiOfferAnalysis(source);
 expect(result.status).toBe("SUCCESS"); expect(result.data?.companyClaimNotice).toContain("unverified");
 const body = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string);
 expect(body.store).toBe(false); expect(body.max_completion_tokens).toBe(3000); expect(body.tools).toBeUndefined();
 fixture.salary.quote = "invented evidence";
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(fixture) } }] })));
 expect((await executeAiOfferAnalysis(source)).status).toBe("ERROR");
});
it("records only bounded token counts from validated provider output",async()=>{
 const fixture=extractOfferTermsRuleBased(source).data,observe=vi.fn();
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(fixture)}}],usage:{prompt_tokens:120,completion_tokens:60,private_field:"never recorded"}})));
 expect((await executeAiOfferAnalysis(source,"WORKER",observe)).status).toBe("SUCCESS");expect(observe).toHaveBeenLastCalledWith({inputTokens:120,outputTokens:60});
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(fixture)}}],usage:{prompt_tokens:-1,completion_tokens:10000001}})));
 await executeAiOfferAnalysis(source,"WORKER",observe);expect(observe).toHaveBeenLastCalledWith({});
});
it("rejects a missing durable consent receipt before provider execution",async()=>{
 mocks.rpc.mockResolvedValue({error:null,data:{}});
 await expect(authorizeAiTransmission({text:source,role:"WORKER",consent:{provider:"openai",noticeVersion:"offer-analysis.v1",transmit:true,policyHash:aiConfiguration()!.policyHash}})).rejects.toMatchObject({code:"SERVICE_UNAVAILABLE"});
 expect(fetch).not.toHaveBeenCalled();
});

it("extracts only exact allowlisted Gemini diagnostics without exposing malicious messages or metadata",async()=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");
 const observe=vi.fn(), logs=[vi.spyOn(console,"log"),vi.spyOn(console,"warn"),vi.spyOn(console,"error")];
 const secret="FICTIONAL_PRIVATE_PAYLOAD";
 try {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({error:{status:"INVALID_ARGUMENT",message:secret,details:[
   {"@type":"type.googleapis.com/google.rpc.ErrorInfo",reason:"API_KEY_INVALID",metadata:{key:secret},domain:secret},
   {"@type":"type.googleapis.com/google.rpc.ErrorInfo",reason:secret},
   {"@type":"type.googleapis.com/google.rpc.BadRequest",fieldViolations:[
    {field:"generationConfig.responseFormat.text.schema",description:secret},
    {field:"generation_config.max_output_tokens",description:secret},
    {field:"generationConfig.responseFormat.text.schema",description:secret},
    {field:`generationConfig.responseFormat.text.schema.properties.${secret}`},
    {field:`contents[0].parts[0].${secret}`},
   ]},
   {"@type":"untrusted",reason:"API_KEY_INVALID",fieldViolations:[{field:"model"}]},
  ]}}),{status:400}));
  const result=await executeAiOfferAnalysis(source,"WORKER",undefined,observe);
  expect(observe).toHaveBeenCalledExactlyOnceWith({status:"INVALID_ARGUMENT",reasons:["API_KEY_INVALID"],fields:["generationConfig.responseFormat.text.schema","generation_config.max_output_tokens"]});
  expect(result.message).toBe("The AI provider rejected the request configuration or credentials. Ask the operator to check model access and configuration.");
  expect(result.status).toBe("ERROR");expect(result.data).toBeNull();
  expect(JSON.stringify([result,observe.mock.calls])).not.toContain(secret);
  expect(result).not.toHaveProperty("diagnostic");expect(fetch).toHaveBeenCalledTimes(1);
  for(const log of logs)expect(log).not.toHaveBeenCalled();
 }finally{for(const log of logs)log.mockRestore();}
});

it.each(["not-json", "null", "[]", JSON.stringify({error:{status:"PRIVATE_VALUE",details:[null,{}, {"@type":"type.googleapis.com/google.rpc.BadRequest",fieldViolations:"private"}]}}), "x".repeat(16385)])("fails safely for malformed, unknown or oversized Gemini errors (case %#)",async body=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");const observe=vi.fn();
 vi.mocked(fetch).mockResolvedValue(new Response(body,{status:400}));
 const result=await executeAiOfferAnalysis(source,"WORKER",undefined,observe);
 expect(observe).toHaveBeenCalledExactlyOnceWith({status:null,reasons:[],fields:[]});
 expect(result.status).toBe("ERROR");expect(result.message).toContain("configuration or credentials");expect(result.data).toBeNull();expect(fetch).toHaveBeenCalledTimes(1);
});

it("bounds streamed errors by bytes, cancels oversized streams and preserves quota classification",async()=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");const observe=vi.fn(),cancel=vi.fn();
 const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode("€".repeat(6000)));},cancel});
 vi.mocked(fetch).mockResolvedValue(new Response(stream,{status:429}));
 const result=await executeAiOfferAnalysis(source,"WORKER",undefined,observe);
 expect(cancel).toHaveBeenCalledTimes(1);expect(observe).toHaveBeenCalledExactlyOnceWith({status:null,reasons:[],fields:[]});
 expect(result.status).toBe("RATE_LIMITED");expect(fetch).toHaveBeenCalledTimes(1);
});

it("does not let observer failures, missing bodies or stream failures replace the original HTTP error",async()=>{
 vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");
 for(const body of [null,new ReadableStream({start(controller){controller.error(new Error("private failure"));}})]){
  vi.mocked(fetch).mockResolvedValueOnce(new Response(body,{status:404}));
  const result=await executeAiOfferAnalysis(source,"WORKER",undefined,()=>{throw new Error("private observer");});
  expect(result.message).toContain("model or resource");expect(JSON.stringify(result)).not.toContain("private");
 }
 expect(fetch).toHaveBeenCalledTimes(2);
});

it.each(["length", "content_filter", "tool_calls", ""])("rejects OpenAI %s even when partial content is valid JSON", async finish => {
 const fixture = extractOfferTermsRuleBased(source).data;
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content: JSON.stringify(fixture) } }] })));
 const observe = vi.fn();
 const result = await executeAiOfferAnalysis(source, "WORKER", observe);
 expect(result.status).toBe("ERROR"); expect(result.data).toBeNull();
 expect(observe).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
});

it("rejects OpenAI refusals and bounds its streamed response before parsing", async () => {
 const fixture = extractOfferTermsRuleBased(source).data;
 vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(fixture), refusal: "private refusal" } }] })));
 const refused = await executeAiOfferAnalysis(source);
 expect(refused.status).toBe("ERROR"); expect(JSON.stringify(refused)).not.toContain("private refusal");
 const cancel = vi.fn();
 vi.mocked(fetch).mockResolvedValueOnce(new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(256 * 1024 + 1)); }, cancel })));
 expect((await executeAiOfferAnalysis(source)).status).toBe("ERROR");
 expect(cancel).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(2);
});

it("classifies argument-message signals without copying any provider message", async () => {
 vi.stubEnv("ORYQEN_AI_PROVIDER", "gemini");
 const observe = vi.fn();
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT", message: 'Unknown field exclusiveMinimum in responseFormat; private@example.test secret-token' } }), { status: 400 }));
 await executeAiOfferAnalysis(source, "WORKER", undefined, observe);
 expect(observe).toHaveBeenCalledExactlyOnceWith({ status: "INVALID_ARGUMENT", reasons: ["SCHEMA_EXCLUSIVE_MINIMUM", "RESPONSE_FORMAT_MENTIONED", "UNKNOWN_FIELD_MENTIONED"], fields: [] });
 expect(JSON.stringify(observe.mock.calls)).not.toContain("private@example.test");
 expect(JSON.stringify(observe.mock.calls)).not.toContain("secret-token");
});

it("sends a low thinking level to Gemini 3 models only, never to other families", async () => {
 for (const [model,expected] of [["gemini-3.1-flash-lite",{thinkingLevel:"low"}],["gemini-2.5-flash",undefined]] as const) {
  vi.resetAllMocks();vi.stubGlobal("fetch",vi.fn());vi.stubEnv("ORYQEN_AI_PROVIDER","gemini");vi.stubEnv("GEMINI_MODEL",model);
  mocks.rpc.mockResolvedValue({error:null,data:{authorizationId:crypto.randomUUID()}});
  vi.mocked(fetch).mockResolvedValue(new Response("{}",{status:500}));
  await executeAiOfferAnalysis(source);
  const body=JSON.parse(vi.mocked(fetch).mock.calls[0]![1]?.body as string);
  expect(body.generationConfig.thinkingConfig).toEqual(expected);
 }
});

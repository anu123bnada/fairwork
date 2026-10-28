import {beforeAll,afterAll,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFile,readdir} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {localPostgresConnection} from "../local-postgres";
import {adminResponse} from "../../src/features/admin/schema";
import {twoAccountFlow} from "../../scripts/hosted-two-account-flow.mjs";
import {followupPage,followupReceipt} from "../../src/features/cases/followup-schema";
import {organizationListSchema,organizationQueueSchema} from "../../src/features/authority/organization-schema";
const db=process.env.FAIRWORK_LOCAL_POSTGRES_PORT?await localPostgresConnection():new PGlite();
const owner=randomUUID(),admin=randomUUID(),support=randomUUID(),auditor=randomUUID(),worker=randomUUID();
const claims=(id:string,aal="aal2",age=0)=>({sub:id,role:"authenticated",aal,is_anonymous:false,amr:[{method:"totp",timestamp:Math.floor(Date.now()/1000)-age}]});
async function rpc(name:string,body:unknown,id:string=owner,aal="aal2",age=0){await db.exec("begin;set local role authenticated");try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(id,aal,age))]);const r=await db.query<{result:Record<string,unknown>}>(`select api.${name}($1::jsonb) result`,[JSON.stringify(body)]);await db.exec("commit");return r.rows[0]!.result;}catch(e){await db.exec("rollback");throw e;}}
const read=(resource="dashboard")=>({resource,cursor:null,search:"",status:"",from:"2026-10-01",to:"2026-10-31"});
const command=(operation:string,targetId:string,version=0,extra={})=>({operation,targetId,expectedRevision:version,reason:"Synthetic administrative test justification",idempotencyKey:randomUUID(),...extra});
const controlledCompany=randomUUID(),representative=randomUUID();
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
 for(const file of (await readdir('supabase/migrations')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 for(const [id,label] of [[owner,"Owner"],[admin,"Admin"],[support,"Support"],[auditor,"Auditor"],[worker,"Worker"]]){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into private.profiles(id,display_name) values($1,$2)",[id,label]);}
 for(const [id,role] of [[owner,"owner"],[admin,"administrator"],[support,"support"],[auditor,"auditor"]])await db.query("insert into private.admin_roles(subject_id,role,expires_at,revision) values($1,$2,now()+interval '1 day',1)",[id,role]);
},120000);
afterAll(()=>db.close());
it("denies worker, aal1 and forged identity before admin disclosure",async()=>{
 await expect(rpc("admin_read",read(),worker)).rejects.toThrow("ACTION_FORBIDDEN");await expect(rpc("admin_read",read(),owner,"aal1")).rejects.toThrow("MFA_REQUIRED");await expect(rpc("admin_read",{...read(),actorId:owner},worker)).rejects.toThrow();
});
it("provides real bounded metadata without raw documents",async()=>{
 const data=await rpc("admin_read",read("users"));expect(data.role).toBe("owner");expect((data.items as unknown[]).length).toBe(5);
 const denied=await db.query("select has_table_privilege('authenticated','private.admin_roles','SELECT') ok,has_column_privilege('fw_admin_exec','private.work_record_versions','content','SELECT') documents");expect(denied.rows[0]).toEqual({ok:false,documents:false});
});
it("enforces role separation and fresh MFA for sensitive commands",async()=>{
 for(const id of [support,auditor])await expect(rpc("admin_command",command("restrict",worker,1,{restricted:true}),id)).rejects.toThrow("ACTION_FORBIDDEN");
 await expect(rpc("admin_command",command("restrict",worker,1,{restricted:true}),admin,"aal2",1200)).rejects.toThrow("MFA_REQUIRED");
 await expect(rpc("admin_command",command("role",worker,0,{role:"owner",expiresAt:new Date(Date.now()+3600000).toISOString()}),admin)).rejects.toThrow("ACTION_FORBIDDEN");
});
it("suspends ordinary accounts with immutable idempotent audit and blocks stale writes",async()=>{
 const body=command("restrict",worker,1,{restricted:true});const first=await rpc("admin_command",body,admin);expect(await rpc("admin_command",body,admin)).toEqual(first);
 await expect(rpc("admin_command",{...body,reason:"Changed retry reason"},admin)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
 await expect(rpc("admin_command",command("restrict",worker,1,{restricted:false}),admin)).rejects.toThrow("VERSION_CONFLICT");
 await expect(rpc("get_me",{},worker)).rejects.toThrow();
 await expect(db.exec("update private.admin_audit set reason='rewrite'")).rejects.toThrow();
});
it("prevents self changes and administrator restriction of privileged accounts",async()=>{
 await expect(rpc("admin_command",command("restrict",owner,1,{restricted:true}),owner)).rejects.toThrow("ACTION_FORBIDDEN");
 await expect(rpc("admin_command",command("restrict",support,1,{restricted:true}),admin)).rejects.toThrow("ACTION_FORBIDDEN");
 await expect(rpc("admin_command",command("role",owner,1,{role:null,expiresAt:null}),owner)).rejects.toThrow("ACTION_FORBIDDEN");
});
it("persists validated settings without allowing security or provider activation",async()=>{
 const body=command("setting",randomUUID(),0,{key:"announcement",value:"Synthetic maintenance notice"});await rpc("admin_command",body,admin);
 expect(JSON.stringify(await rpc("admin_read",read("settings"),auditor))).toContain("Synthetic maintenance notice");
 await expect(rpc("admin_command",{...body,key:"ai_enabled",value:true,idempotencyKey:randomUUID()},owner)).rejects.toThrow("VALIDATION_FAILED");
});
it("revocation immediately denies old claims and audit remains readable only by admins",async()=>{
 await rpc("admin_command",command("role",support,1,{role:null,expiresAt:null}));await expect(rpc("admin_read",read(),support)).rejects.toThrow("ACTION_FORBIDDEN");
 expect((await rpc("admin_read",read("audit"),auditor)).items).toBeInstanceOf(Array);
});
it("validates every metadata queue and dashboard against the public response contract",async()=>{
 for(const resource of ["dashboard","search","users","organizations","requests","offers","agreements","work","cases","privacy","shares","ai","roles","settings","incidents","evidence_access","audit"]){expect(adminResponse.safeParse(await rpc("admin_read",read(resource))).success,resource).toBe(true);}
});
it("rejects null values, unknown keys and invalid date windows at the RPC boundary",async()=>{
 for(const extra of [{key:"announcement",value:null},{key:"analysis_paused",value:null},{key:"unreviewed_flag",value:true}])await expect(rpc("admin_command",command("setting",randomUUID(),0,extra))).rejects.toThrow("VALIDATION_FAILED");
 await expect(rpc("admin_read",{...read(),from:"2025-01-01"})).rejects.toThrow("VALIDATION_FAILED");
 await expect(rpc("admin_command",command("incident",randomUUID(),0,{title:"Synthetic incident",category:null,status:"open",priority:"normal",assignedTo:null}))).rejects.toThrow("VALIDATION_FAILED");
});
it("persists incident revisions, rejects stale updates and retains audit justification",async()=>{
 const target=randomUUID();const body=command("incident",target,0,{title:"Synthetic security event",category:"security",status:"open",priority:"high",assignedTo:admin});
 await rpc("admin_command",body,admin);await rpc("admin_command",{...body,expectedRevision:1,status:"in_review",idempotencyKey:randomUUID()},admin);
 await expect(rpc("admin_command",{...body,idempotencyKey:randomUUID()},admin)).rejects.toThrow("VERSION_CONFLICT");
 expect((await rpc("admin_read",read("incidents"))).items).toEqual(expect.arrayContaining([expect.objectContaining({id:target,revision:2,status:"in_review"})]));
});
it("grants narrowly scoped capabilities with optimistic revisions and no self grants",async()=>{
 const extra={capability:"privacy_operator",expiresAt:new Date(Date.now()+3600000).toISOString(),revoke:false};
 await rpc("admin_command",command("capability",admin,0,extra));
 await expect(rpc("admin_command",command("capability",admin,0,extra))).rejects.toThrow("VERSION_CONFLICT");
 await rpc("admin_command",command("capability",admin,1,{...extra,revoke:true,expiresAt:null}));
 await expect(rpc("admin_command",command("capability",owner,0,extra))).rejects.toThrow("ACTION_FORBIDDEN");
});
it("enforces AI pause in the database while retaining consent and budget protections",async()=>{
 const target=randomUUID();await rpc("admin_command",command("setting",target,0,{key:"analysis_paused",value:true}));
 await expect(rpc("authorize_ai_transmission",{provider:"gemini",model:"gemini-2.5-flash",noticeVersion:"offer-analysis.v1",inputHash:"a".repeat(64),consent:true,processingRegion:"isolated fixture only",dataUse:"isolated synthetic test",policyHash:"b".repeat(64)},admin)).rejects.toThrow("SERVICE_UNAVAILABLE");
 await rpc("admin_command",command("setting",target,1,{key:"analysis_paused",value:false}));
 const quota=randomUUID();await rpc("admin_command",command("setting",quota,0,{key:"ai_minute_account",value:1}));
 await expect(rpc("admin_command",command("setting",quota,1,{key:"ai_minute_account",value:4}))).rejects.toThrow("VALIDATION_FAILED");
 const admission={provider:"gemini",model:"gemini-2.5-flash",noticeVersion:"offer-analysis.v1",inputHash:"c".repeat(64),consent:true,processingRegion:"isolated fixture only",dataUse:"isolated synthetic test",policyHash:"d".repeat(64)};
 await rpc("authorize_ai_transmission",admission,admin);await expect(rpc("authorize_ai_transmission",admission,admin)).rejects.toThrow("RATE_LIMITED");
 expect(await rpc("platform_notices",{},admin)).toEqual({announcement:"Synthetic maintenance notice"});
 await expect(rpc("platform_notices",{key:"analysis_paused"},admin)).rejects.toThrow("VALIDATION_FAILED");
});
it("accepts any safe configured model and the self-hosted provider, and still refuses unsafe identifiers",async()=>{
 const base={noticeVersion:"offer-analysis.v1",consent:true,processingRegion:"isolated fixture only",dataUse:"isolated synthetic test",policyHash:"e".repeat(64)};
 // The per-account minute limit set by the previous test applies to each account, so each provider is authorized by a different account.
 await rpc("authorize_ai_transmission",{...base,provider:"gemini",model:"gemini-3.1-flash-lite",inputHash:"1".repeat(64)},owner);
 await rpc("authorize_ai_transmission",{...base,provider:"openai",model:"gpt-5-mini",inputHash:"2".repeat(64)},support);
 await rpc("authorize_ai_transmission",{...base,provider:"selfhosted",model:"llama3.1:8b-instruct",inputHash:"3".repeat(64)},auditor);
 for(const bad of [{provider:"gemini",model:"gpt-4o"},{provider:"gemini",model:"../other?key=x"},{provider:"openai",model:""},{provider:"anthropic",model:"claude-x"},{provider:"selfhosted",model:"a b"},{provider:"gemini",model:"x".repeat(101)}])
  await expect(rpc("authorize_ai_transmission",{...base,...bad,inputHash:"4".repeat(64)},owner),JSON.stringify(bad)).rejects.toThrow("VALIDATION_FAILED");
});
it.skipIf(!process.env.FAIRWORK_LOCAL_POSTGRES_PORT)("serializes simultaneous conflicting PostgreSQL commands",async()=>{
 const a=await localPostgresConnection(),b=await localPostgresConnection();const target=randomUUID();
 const commandBody=command("incident",target,0,{title:"Concurrent fixture event",category:"security",status:"open",priority:"normal",assignedTo:null});
 async function send(connection:typeof a,body:unknown){await connection.exec("begin;set local role authenticated");try{await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(owner))]);await connection.query("select api.admin_command($1::jsonb)",[JSON.stringify(body)]);await connection.exec("commit");}catch(error){await connection.exec("rollback");throw error;}}
 try{const results=await Promise.allSettled([send(a,commandBody),send(b,{...commandBody,idempotencyKey:randomUUID(),priority:"urgent"})]);expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);const rejected=results.find(r=>r.status==="rejected");expect(String(rejected?.reason)).toContain("VERSION_CONFLICT");}finally{await a.close();await b.close();}
});
it("persists participant responses and independently reviewed appeals without rewriting history",async()=>{
 const employee=randomUUID(),employer=randomUUID(),reviewer=randomUUID(),newReviewer=randomUUID(),operator=randomUUID();
 for(const id of [employee,employer,reviewer,newReviewer,operator]){await db.query("insert into auth.users values($1)",[id]);await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic followup fixture')",[id]);}
 for(const [id,cap] of [[admin,"authority_operator"],[operator,"review_operator"],[reviewer,"reviewer"],[newReviewer,"reviewer"]])await db.query("insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values($1,$2,$3,'Isolated synthetic fixture',now()+interval '1 day')",[id,cap,owner]);
 const company=await rpc("provision_company",{name:"Synthetic appeal company",idempotencyKey:randomUUID()},admin);
 await rpc("decide_membership",{companyId:company.id,subjectId:employer,decision:"approve",expectedRevision:0,expiresAt:new Date(Date.now()+86400000).toISOString(),reviewedEvidenceRefs:["demo:fixture/independence"],reason:"Independent synthetic representative approval",policyVersion:"demo-authority.v1",idempotencyKey:randomUUID()},admin);
 const workflow=await twoAccountFlow({worker:{id:employee},employer:{id:employer},companyId:String(company.id),record:()=>{},request:async(actor,path,body,statuses=[200])=>{
  const url=new URL(path,"https://fixture.invalid");if(statuses.includes(422)){expect(url.searchParams.has("ownerId")).toBe(true);return;}
  const name=body?({"/api/v1/offers":"review_offer","/api/v1/agreement-workflows":"agreement_workflow","/api/v1/work-records":"work_command","/api/v1/passport":"initialize_passport"} as Record<string,string>)[url.pathname]:({"/api/v1/agreements":"get_agreement","/api/v1/agreement-workflows":"read_agreement_workflow","/api/v1/work-records":"read_work","/api/v1/passport":"read_passport"} as Record<string,string>)[url.pathname];if(!name)throw new Error("Unmapped fixture transport");
  const payload=body??(url.searchParams.size?Object.fromEntries(url.searchParams):{cursor:null});if(statuses.includes(403)){await expect(rpc(name,payload,actor.id)).rejects.toThrow("ACTION_FORBIDDEN");return;}return rpc(name,payload,actor.id);
 }});
 const work=await rpc("read_work",{workId:workflow.workId},employee);const version=(work.versions as {version:number;contentHash:string;evidenceHash:string;state:string}[]).at(-1)!;const caseId=randomUUID();
 await rpc("work_case_command",{operation:"open",caseId,workId:workflow.workId,expectedVersion:version.version,expectedHash:version.contentHash,expectedEvidenceHash:version.evidenceHash,expectedState:version.state,reasonCode:"evidence_integrity",reason:"Synthetic concern",idempotencyKey:randomUUID()},employee);
 const response={caseId,operation:"response",expectedRevision:1,message:"Synthetic participant response",idempotencyKey:randomUUID()};const receipt=followupReceipt.parse(await rpc("case_followup_command",response,employer));expect(await rpc("case_followup_command",response,employer)).toEqual(receipt);
 await expect(rpc("case_followup_command",{...response,actorId:employee},employer)).rejects.toThrow("VALIDATION_FAILED");
 await expect(rpc("case_followup_read",{caseId,cursor:null},owner)).rejects.toThrow("NOT_FOUND");
 expect(followupPage.parse(await rpc("case_followup_read",{caseId,cursor:null},employee)).items).toHaveLength(1);
 async function assignAndAccept(id:string,candidate:string){const c=await rpc("read_work_case",{caseId:id},operator);await rpc("work_case_command",{operation:"assign",caseId:id,expectedRevision:c.revision,reviewerId:candidate,expiresAt:new Date(Date.now()+3600000).toISOString(),reason:"Independent synthetic assignment",idempotencyKey:randomUUID()},operator);const a=await rpc("read_work_case",{caseId:id},candidate);await rpc("work_case_command",{operation:"accept",caseId:id,expectedRevision:a.revision,noConflict:true,idempotencyKey:randomUUID()},candidate);}
 await assignAndAccept(caseId,reviewer);const c=await rpc("read_work_case",{caseId},reviewer);await rpc("work_case_command",{operation:"decide",caseId,expectedRevision:c.revision,outcome:"uphold",rationale:"Synthetic independent decision",idempotencyKey:randomUUID()},reviewer);
 const resolved=await rpc("read_work_case",{caseId},employee);const appeal={caseId,operation:"appeal",expectedRevision:resolved.revision,message:"Synthetic grounds for independent appeal",idempotencyKey:randomUUID()};
 const opened=followupReceipt.parse(await rpc("case_followup_command",appeal,employee));expect(opened.linkedCaseId).not.toBeNull();expect(await rpc("case_followup_command",appeal,employee)).toEqual(opened);
 await expect(rpc("work_case_command",{operation:"assign",caseId:opened.linkedCaseId,expectedRevision:1,reviewerId:reviewer,expiresAt:new Date(Date.now()+3600000).toISOString(),reason:"Disallowed previous reviewer",idempotencyKey:randomUUID()},operator)).rejects.toThrow("ACTION_FORBIDDEN");
 await assignAndAccept(opened.linkedCaseId!,newReviewer);const next=await rpc("read_work_case",{caseId:opened.linkedCaseId},newReviewer);await rpc("work_case_command",{operation:"decide",caseId:opened.linkedCaseId,expectedRevision:next.revision,outcome:"dismiss",rationale:"Independent appeal resolution",idempotencyKey:randomUUID()},newReviewer);
 expect((await rpc("read_work_case",{caseId},employee)).resolution).toEqual(resolved.resolution);
 expect(JSON.stringify((await rpc("read_passport",{cursor:null},employee)).entries)).not.toContain(workflow.workId);
 const events=await rpc("notifications",{operation:"list",cursorAt:null,cursorKey:null},employee);expect(JSON.stringify(events)).toContain("case_followup");expect(JSON.stringify(events)).not.toContain("Synthetic participant response");
 await expect(db.exec("update private.case_followups set message='rewritten'")).rejects.toThrow("ACTION_FORBIDDEN");
 const access=await db.query<{n:number}>("select count(*)::int n from private.case_access_events where case_id=$1",[caseId]);expect(access.rows[0]!.n).toBeGreaterThan(0);
});
it.skipIf(!process.env.FAIRWORK_LOCAL_POSTGRES_PORT)("a waiting administrative read rechecks committed role revocation",async()=>{
 const subject=randomUUID();await db.query("insert into auth.users values($1)",[subject]);await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic revocation fixture')",[subject]);await rpc("admin_command",command("role",subject,0,{role:"auditor",expiresAt:new Date(Date.now()+3600000).toISOString()}));
 const revoker=await localPostgresConnection(),reader=await localPostgresConnection();let pending:Promise<unknown>|undefined;
 try{
  await revoker.exec("begin;set local role authenticated");await revoker.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(owner))]);await revoker.query("select api.admin_command($1::jsonb)",[JSON.stringify(command("role",subject,1,{role:null,expiresAt:null}))]);
  await reader.exec("begin;set local role authenticated");await reader.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(subject))]);pending=reader.query("select api.admin_read($1::jsonb)",[JSON.stringify(read())]).then(()=>"unexpected disclosure",error=>error);
  let waiting=false;for(let attempt=0;attempt<100;attempt++){const locks=await db.query<{n:number}>("select count(*)::int n from pg_locks where locktype='advisory' and not granted");if(locks.rows[0]!.n>0){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}expect(waiting).toBe(true);
  await revoker.exec("commit");expect(String(await pending)).toContain("ACTION_FORBIDDEN");
 }finally{await revoker.exec("rollback").catch(()=>undefined);if(pending)await pending;await reader.exec("rollback").catch(()=>undefined);await revoker.close();await reader.close();}
});

it("reports database-backed activity, UTC trends and queue alerts without private details",async()=>{
 const result=adminResponse.parse(await rpc("admin_read",read()));
 expect(result.overview).toBeDefined();
 expect(result.overview!.trends).toHaveLength(31);
 expect(result.overview!.alerts).toHaveLength(4);
 const cases=await db.query<{n:number}>("select count(*)::int n from private.work_cases where status='open'");
 expect(result.overview!.alerts.find(a=>a.kind==="open_cases")!.count).toBe(cases.rows[0]!.n);
 const times=result.overview!.activity.map(a=>Date.parse(a.recordedAt));
 expect(times).toEqual([...times].sort((a,b)=>b-a));
 expect(result.overview!.activity.every(a=>!Object.hasOwn(a,"detail"))).toBe(true);
 expect(result.metrics!.completedAnalyses).toBeNull();
});
it("suspension blocks representative access, preserves history and requires independent fresh-MFA administration",async()=>{
 await db.query("insert into auth.users values($1)",[representative]);
 await db.query("insert into private.profiles(id,display_name) values($1,'Organization suspension fixture')",[representative]);
 // Fixture setup only. Real organization admission remains the independent workflow.
 await db.query("insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values($1,'authority_operator',$2,'Isolated suspension fixture',now()+interval '1 day')",[owner,admin]);
 const company=await rpc("provision_company",{name:"Organization suspension fixture",idempotencyKey:controlledCompany});
 await rpc("decide_membership",{companyId:company.id,subjectId:representative,decision:"approve",expectedRevision:0,expiresAt:new Date(Date.now()+86400000).toISOString(),reviewedEvidenceRefs:["demo:fixture/independent"],reason:"Independent synthetic representative decision",policyVersion:"demo-authority.v1",idempotencyKey:randomUUID()});
 const current=await rpc("company_profile",{operation:"read",companyId:company.id},representative);expect(current.canEdit).toBe(true);
 const body=command("organization_status",String(company.id),0,{suspended:true});
 for(const subject of [auditor,representative])await expect(rpc("admin_command",body,subject)).rejects.toThrow("ACTION_FORBIDDEN");
 await expect(rpc("admin_command",body,admin,"aal2",1200)).rejects.toThrow("MFA_REQUIRED");
 await expect(rpc("admin_command",{...body,suspended:null},admin)).rejects.toThrow("VALIDATION_FAILED");
 const receipt=await rpc("admin_command",body,admin);expect(await rpc("admin_command",body,admin)).toEqual(receipt);
 await expect(rpc("company_profile",{operation:"read",companyId:company.id},representative)).rejects.toThrow("NOT_FOUND");
 await expect(rpc("admin_command",{...body,idempotencyKey:randomUUID()},admin)).rejects.toThrow("VERSION_CONFLICT");
 expect((await rpc("admin_read",read("organizations"))).items).toEqual(expect.arrayContaining([expect.objectContaining({id:company.id,status:"suspended",revision:1})]));
 await rpc("admin_command",command("organization_status",String(company.id),1,{suspended:false}),admin);
 expect((await rpc("company_profile",{operation:"read",companyId:company.id},representative)).canEdit).toBe(true);
 // An administrator who was ever a member cannot manage this organization's state.
 await rpc("decide_membership",{companyId:company.id,subjectId:admin,decision:"approve",expectedRevision:0,expiresAt:new Date(Date.now()+86400000).toISOString(),reviewedEvidenceRefs:["demo:fixture/independent"],reason:"Independent synthetic administrator membership",policyVersion:"demo-authority.v1",idempotencyKey:randomUUID()});
 await expect(rpc("admin_command",command("organization_status",String(company.id),2,{suspended:true}),admin)).rejects.toThrow("ACTION_FORBIDDEN");
 const history=await db.query<{n:number}>("select count(*)::int n from private.company_membership_decisions where company_id=$1 and subject_id=$2",[company.id,representative]);expect(history.rows[0]!.n).toBe(1);
 await expect(db.exec("set role authenticated;select * from private.organization_controls")).rejects.toThrow();
 await db.exec("reset role");
});
it("links one organization appeal, protects applicant isolation and requires a different reviewer",async()=>{
 const original=await rpc("request_organization",{companyId:null,companyName:"Synthetic appeal applicant",statement:"Original synthetic membership request",idempotencyKey:randomUUID()},representative);
 const rejection={requestId:original.requestId,decision:"reject",reason:"Insufficient synthetic authority evidence",expiresAt:null,reviewedEvidenceRefs:[],expectedRevision:0};
 await rpc("decide_organization_request",rejection,owner);
 const appeal={requestId:original.requestId,grounds:"Corrected synthetic authority evidence for appeal",idempotencyKey:randomUUID()};
 await expect(rpc("appeal_organization_request",appeal,admin)).rejects.toThrow("NOT_FOUND");
 await expect(rpc("appeal_organization_request",{...appeal,actorId:admin},representative)).rejects.toThrow("VALIDATION_FAILED");
 const receipt=await rpc("appeal_organization_request",appeal,representative);expect(await rpc("appeal_organization_request",appeal,representative)).toEqual(receipt);
 await expect(rpc("appeal_organization_request",{...appeal,idempotencyKey:randomUUID()},representative)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
 await expect(rpc("decide_organization_request",{...rejection,requestId:receipt.requestId},owner)).rejects.toThrow("ACTION_FORBIDDEN");
 const list=organizationListSchema.parse(await rpc("list_organization_requests",{cursor:null},representative));
 expect(list.items).toEqual(expect.arrayContaining([expect.objectContaining({requestId:original.requestId,decision:"reject",appealRequestId:receipt.requestId}),expect.objectContaining({requestId:receipt.requestId,parentRequestId:original.requestId})]));
 const queue=organizationQueueSchema.parse(await rpc("list_organization_queue",{cursor:null},admin));
 expect(queue.items).toEqual(expect.arrayContaining([expect.objectContaining({requestId:receipt.requestId,parentRequestId:original.requestId,previousDecisionReason:rejection.reason})]));
 await rpc("decide_organization_request",{...rejection,requestId:receipt.requestId},admin);
 await expect(rpc("appeal_organization_request",{...appeal,requestId:receipt.requestId,idempotencyKey:randomUUID()},representative)).rejects.toThrow("ACTION_FORBIDDEN");
 await expect(db.exec("delete from private.organization_appeals")).rejects.toThrow("ACTION_FORBIDDEN");
});
it("accepts telemetry only from the narrow writer and binds AI outcomes to stored consent",async()=>{
 const event={id:randomUUID(),kind:"login_failure",operation:"auth.sign-in",code:"AUTH_REQUIRED"};
 await db.exec("begin;set local role authenticated");
 await expect(db.query("select runtime_ingest.record_event($1::jsonb)",[JSON.stringify(event)])).rejects.toThrow();await db.exec("rollback");
 async function write(value:unknown){await db.exec("begin;set local role oryqen_telemetry_writer");try{await db.query("select runtime_ingest.record_event($1::jsonb)",[JSON.stringify(value)]);await db.exec("commit");}catch(e){await db.exec("rollback");throw e;}}
 await write(event);await write(event);
 await expect(write({...event,operation:"altered.operation"})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
 await expect(write({...event,id:randomUUID(),email:"private@example.test"})).rejects.toThrow("VALIDATION_FAILED");
 await expect(write({...event,id:randomUUID(),subjectId:owner})).rejects.toThrow("VALIDATION_FAILED");
 await expect(write({id:randomUUID(),kind:"ai_success",operation:"offer.analysis",authorizationId:randomUUID()})).rejects.toThrow("VALIDATION_FAILED");
 const consent=await db.query<{id:string}>("select id from private.ai_transmission_authorizations limit 1");
 const aid=consent.rows[0]!.id;
 await write({id:randomUUID(),kind:"ai_attempt",operation:"offer.analysis",authorizationId:aid});
 await write({id:randomUUID(),kind:"ai_success",operation:"offer.analysis",authorizationId:aid,durationMs:240,inputTokens:120,outputTokens:60});
 await expect(write({id:randomUUID(),kind:"ai_error",operation:"offer.analysis",authorizationId:aid})).rejects.toThrow();
 const summary=adminResponse.parse(await rpc("admin_read",read("telemetry"),auditor));
 expect(summary.telemetry).toMatchObject({aiAttempts:1,aiSucceeded:1,aiFailed:0,loginFailures:1,providerCost:null});
 expect(JSON.stringify(summary)).not.toContain("input_hash");
 const privileges=await db.query("select has_table_privilege('oryqen_telemetry_writer','private.runtime_events','INSERT') as direct_write,has_table_privilege('oryqen_telemetry_writer','private.profiles','SELECT') as profiles,has_function_privilege('authenticated','runtime_ingest.record_event(jsonb)','EXECUTE') as spoof");
 expect(privileges.rows[0]).toEqual({direct_write:false,profiles:false,spoof:false});
 await expect(db.exec("update private.runtime_events set code='INTERNAL_ERROR'")).rejects.toThrow("ACTION_FORBIDDEN");
});
it("consumes validated notification templates and incident categories without changing event titles or authority",async()=>{
 const templateId=randomUUID(),categoriesId=randomUUID();
 await expect(rpc("admin_command",command("setting",templateId,0,{key:"notification_template",value:"Fake {actor} message"}))).rejects.toThrow("VALIDATION_FAILED");
 await rpc("admin_command",command("setting",templateId,0,{key:"notification_template",value:"Account update: {title}"}));
 const notices=await rpc("notifications",{operation:"list",cursorAt:null,cursorKey:null},representative);
 const items=notices.items as {title:string;message:string}[];expect(items.length).toBeGreaterThan(0);
 for(const item of items)expect(item.message).toBe(`Account update: ${item.title}`);
 await expect(rpc("admin_command",command("setting",categoriesId,0,{key:"support_categories",value:"security,untrusted"}))).rejects.toThrow("VALIDATION_FAILED");
 const setting=command("setting",categoriesId,0,{key:"support_categories",value:"support,moderation"});await rpc("admin_command",setting);
 const result=adminResponse.parse(await rpc("admin_read",read("incidents")));expect(result.incidentCategories).toEqual(["support","moderation"]);
 const incident=command("incident",randomUUID(),0,{title:"Synthetic incident",category:"security",status:"open",priority:"normal",assignedTo:null});
 await expect(rpc("admin_command",incident,admin)).rejects.toThrow("VALIDATION_FAILED");
 const permitted={...incident,category:"support"};const receipt=await rpc("admin_command",permitted,admin);
 await rpc("admin_command",command("setting",categoriesId,1,{key:"support_categories",value:"moderation"}));
 expect(await rpc("admin_command",permitted,admin)).toEqual(receipt);
 await rpc("admin_command",{...permitted,idempotencyKey:randomUUID(),expectedRevision:1,status:"resolved"},admin);
 await expect(rpc("admin_command",setting,auditor)).rejects.toThrow("ACTION_FORBIDDEN");
});
it.skipIf(!process.env.FAIRWORK_LOCAL_POSTGRES_PORT)("a representative waiting on organization suspension cannot read after it commits",async()=>{
 const company=await rpc("provision_company",{name:"Concurrent suspension fixture",idempotencyKey:randomUUID()});
 await rpc("decide_membership",{companyId:company.id,subjectId:representative,decision:"approve",expectedRevision:0,expiresAt:new Date(Date.now()+86400000).toISOString(),reviewedEvidenceRefs:["demo:fixture/concurrent"],reason:"Independent synthetic membership",policyVersion:"demo-authority.v1",idempotencyKey:randomUUID()});
 const a=await localPostgresConnection(),b=await localPostgresConnection();let pending:Promise<unknown>|undefined;
 try{
  await a.exec("begin;set local role authenticated");await a.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(owner))]);await a.query("select api.admin_command($1::jsonb)",[JSON.stringify(command("organization_status",String(company.id),0,{suspended:true}))]);
  await b.exec("begin;set local role authenticated");await b.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(representative))]);pending=b.query("select api.company_profile($1::jsonb)",[JSON.stringify({operation:"read",companyId:company.id})]).then(()=>"unexpected disclosure",error=>error);
  let waiting=false;for(let n=0;n<100;n++){const r=await db.query<{n:number}>("select count(*)::int n from pg_locks where locktype='advisory' and not granted");if(r.rows[0]!.n){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}expect(waiting).toBe(true);
  await a.exec("commit");expect(String(await pending)).toContain("NOT_FOUND");
 }finally{await a.exec("rollback").catch(()=>undefined);if(pending)await pending;await b.exec("rollback").catch(()=>undefined);await a.close();await b.close();}
});

it("records an export in the immutable audit trail without its contents, idempotently, and refuses non-administrators, stale MFA and malformed requests",async()=>{
 const body={exportId:randomUUID(),resource:"audit",count:3,complete:true,checksum:"a".repeat(64),filterNames:["resource","from"]};
 expect(await rpc("admin_export_log",body,auditor)).toEqual({exportId:body.exportId,recorded:true,replayed:false});
 expect(await rpc("admin_export_log",body,auditor)).toEqual({exportId:body.exportId,recorded:true,replayed:true});
 const rows=(await db.query<{actor_id:string;action:string;reason:string;changes:Record<string,unknown>}>("select actor_id,action,reason,changes from private.admin_audit where action='export' and changes->>'exportId'=$1",[body.exportId])).rows;
 expect(rows).toHaveLength(1);
 expect(rows[0]).toMatchObject({actor_id:auditor,action:"export",reason:"Exported audit records",changes:{resource:"audit",count:3,complete:true,checksum:"a".repeat(64),filterNames:["resource","from"]}});
 expect(Object.keys(rows[0]!.changes).sort()).toEqual(["checksum","complete","count","exportId","filterNames","resource"]);
 await expect(db.query("update private.admin_audit set reason='Changed after the fact' where action='export'")).rejects.toThrow();
 await expect(rpc("admin_export_log",{...body,exportId:randomUUID()},worker)).rejects.toThrow(/ACTION_FORBIDDEN|AUTH_REQUIRED/);
 await expect(rpc("admin_export_log",{...body,exportId:randomUUID()},auditor,"aal1")).rejects.toThrow();
 await expect(rpc("admin_export_log",{...body,exportId:randomUUID()},auditor,"aal2",1200)).rejects.toThrow("MFA_REQUIRED");
 for(const bad of [{...body,exportId:randomUUID(),extra:1},{...body,exportId:randomUUID(),checksum:"xyz"},{...body,exportId:randomUUID(),resource:"payroll"},{...body,exportId:randomUUID(),count:-1},{...body,exportId:randomUUID(),count:1.5},{...body,exportId:randomUUID(),filterNames:["a b"]},{...body,exportId:randomUUID(),filterNames:Array(9).fill("x")},{...body,exportId:"not-a-uuid"},{...body,exportId:randomUUID(),complete:"yes"}])
  await expect(rpc("admin_export_log",bad,auditor)).rejects.toThrow("VALIDATION_FAILED");
 const audit=await rpc("admin_read",{...read("audit"),search:"export"},auditor);
 const entry=(audit.items as {label:string;detail:{changes?:Record<string,unknown>}}[]).find(item=>item.label==="export");
 expect(entry?.detail.changes).toMatchObject({resource:"audit",count:3,checksum:"a".repeat(64)});
});

// ---- cross-record audit integrity (module 10)
const asSuperuser=async(sql:string)=>{await db.exec("reset role");await db.exec("set session_replication_role = replica");try{return await db.query(sql);}finally{await db.exec("set session_replication_role = origin");}};
const verify=(id=owner)=>rpc("audit_chain_verify",{},id) as Promise<{checked:number;ok:boolean;brokenLinks:number;alteredOrDeletedRecords:number;recordsNotInChain:number;firstProblemSeq:number|null;head:string|null}>;
it("chains every audit row in one global order and lets an administrator with fresh MFA verify it, and nobody else",async()=>{
 const result=await verify();
 expect(result.ok).toBe(true);expect(result.checked).toBeGreaterThan(0);expect(result.head).toMatch(/^[0-9a-f]{64}$/);
 expect(result).toMatchObject({brokenLinks:0,alteredOrDeletedRecords:0,recordsNotInChain:0,firstProblemSeq:null});
 const source=(await db.query<{n:string}>("select ((select count(*) from private.audit_logs)+(select count(*) from private.admin_audit))::text n")).rows[0]!.n;
 expect(String(result.checked)).toBe(source);
 expect((await verify(admin)).ok).toBe(true);
 const plain=randomUUID();await db.query("insert into auth.users values($1)",[plain]);await db.query("insert into private.profiles(id,display_name) values($1,'Plain account')",[plain]);
 await expect(rpc("audit_chain_verify",{},plain)).rejects.toThrow("ACTION_FORBIDDEN");
 await expect(rpc("audit_chain_verify",{},owner,"aal1")).rejects.toThrow("MFA_REQUIRED");
 await expect(rpc("audit_chain_verify",{extra:1},owner)).rejects.toThrow("VALIDATION_FAILED");
 const grants=await db.query<{ok:boolean}>("select has_table_privilege('authenticated','private.audit_chain','SELECT') ok");expect(grants.rows[0]!.ok).toBe(false);
 await expect(db.query("select * from private.audit_chain")).resolves.toBeTruthy();
});
it("a new audit write extends the chain by exactly one link",async()=>{
 const before=(await verify()).checked;
 await rpc("admin_command",command("restrict",worker,2,{restricted:false}),admin).catch(()=>undefined);
 await rpc("admin_command",command("setting",worker,0,{}),admin).catch(()=>undefined);
 await asSuperuser("update private.admin_audit set reason=reason where false");
 const after=(await verify());expect(after.ok).toBe(true);expect(after.checked).toBeGreaterThanOrEqual(before);
});
it("detects an edited audit row, an unchained insertion and an edited chain link, and recovers when they are undone",async()=>{
 const original=(await db.query<{id:string;reason:string}>("select id,reason from private.admin_audit order by created_at,id limit 1")).rows[0]!;
 await asSuperuser(`update private.admin_audit set reason='Tampered reason text for the test' where id='${original.id}'`);
 let r=await verify();expect(r.ok).toBe(false);expect(r.alteredOrDeletedRecords).toBe(1);expect(r.firstProblemSeq).not.toBeNull();
 await asSuperuser(`update private.admin_audit set reason='${original.reason.replace(/'/g,"''")}' where id='${original.id}'`);
 expect((await verify()).ok).toBe(true);
 const extra=randomUUID();
 await asSuperuser(`insert into private.admin_audit(id,actor_id,action,target_id,revision,reason,changes) values('${extra}','${owner}','settings','${owner}',1,'Inserted while triggers were off','{}'::jsonb)`);
 r=await verify();expect(r.ok).toBe(false);expect(r.recordsNotInChain).toBe(1);
 await asSuperuser(`delete from private.admin_audit where id='${extra}'`);
 expect((await verify()).ok).toBe(true);
 const link=(await db.query<{seq:string;record_hash:string}>("select seq::text seq,record_hash from private.audit_chain order by seq limit 1")).rows[0]!;
 await asSuperuser(`update private.audit_chain set record_hash='${"a".repeat(64)}' where seq=${link.seq}`);
 r=await verify();expect(r.ok).toBe(false);expect(r.brokenLinks).toBeGreaterThanOrEqual(1);expect(r.firstProblemSeq).toBe(Number(link.seq));
 await asSuperuser(`update private.audit_chain set record_hash='${link.record_hash}' where seq=${link.seq}`);
 expect((await verify()).ok).toBe(true);
});
it("refuses to rewrite the chain or the audit tables through the normal path",async()=>{
 await db.exec("reset role");
 await expect(db.exec("update private.audit_chain set record_hash=record_hash")).rejects.toThrow();
 await expect(db.exec("delete from private.audit_chain")).rejects.toThrow();
 await expect(db.exec("update private.admin_audit set reason=reason")).rejects.toThrow();
});
const writeAudit=async(sql:string)=>{await db.exec("reset role");return db.query(sql);};
it("verification does not depend on the session time zone that wrote or reads the rows",async()=>{
 const saved=(await db.query<{tz:string}>("select current_setting('TimeZone') tz")).rows[0]!.tz;
 try{
  expect((await verify()).ok,"baseline in the default zone "+saved).toBe(true);
  await db.exec("reset role");await db.exec("set time zone 'Asia/Colombo'");
  await writeAudit(`insert into private.admin_audit(id,actor_id,action,target_id,revision,reason,changes) values('${randomUUID()}','${owner}','settings','${owner}',1,'Written from a UTC+05:30 session','{}'::jsonb)`);
  await db.exec("set time zone 'UTC'");
  const utc=await verify();
  await db.exec("set time zone 'America/Los_Angeles'");
  const la=await verify();
  expect({ok:utc.ok,bad:utc.alteredOrDeletedRecords},"verified from UTC").toEqual({ok:true,bad:0});
  expect({ok:la.ok,bad:la.alteredOrDeletedRecords},"verified from America/Los_Angeles").toEqual({ok:true,bad:0});
 }finally{await db.exec(`set time zone '${saved}'`);}
});
// leaves the chain deliberately broken (a deleted audit row), so it must stay the last verifying test
it("each audit write adds exactly one link, in either audit table, and a deleted audit row is detected",async()=>{
 const before=(await verify()).checked;
 const a=randomUUID(),b=randomUUID();
 await writeAudit(`insert into private.admin_audit(id,actor_id,action,target_id,revision,reason,changes) values('${a}','${owner}','settings','${owner}',1,'Chain growth probe','{}'::jsonb)`);
 expect((await verify()).checked).toBe(before+1);
 await writeAudit(`insert into private.audit_logs(id,actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values('${b}','${owner}','update_profile','${owner}','${randomUUID()}',array['display_name'],'offline_capability_bootstrap','authority')`);
 const grown=await verify();expect(grown.ok).toBe(true);expect(grown.checked).toBe(before+2);
 const src=(await db.query<{source:string}>("select source from private.audit_chain order by seq desc limit 2")).rows.map(r=>r.source).sort();expect(src).toEqual(["admin_audit","audit_logs"]);
 await asSuperuser(`delete from private.audit_logs where id='${b}'`);
 const gone=await verify();expect(gone.ok).toBe(false);expect(gone.alteredOrDeletedRecords).toBe(1);expect(gone.firstProblemSeq).not.toBeNull();
});
it("keeps verification closed to reviewers, operators and organization representatives",async()=>{
 for(const id of [worker,representative])await expect(rpc("audit_chain_verify",{},id)).rejects.toThrow(/ACTION_FORBIDDEN|AUTH_REQUIRED/);
 await expect(rpc("audit_chain_verify",{},support)).rejects.toThrow(/ACTION_FORBIDDEN|AUTH_REQUIRED/);
});

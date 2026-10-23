// Offline LOCAL-only procedure. No public endpoint, passwords or default account.
// --check is read-only. --prepare requires explicit founder approval first.
import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
import {randomUUID} from "node:crypto";
import path from "node:path";
import {checkLocalDocker} from "./local-development-runtime.mjs";
const args=process.argv.slice(2),mode=args[0];
const arg=name=>args[args.indexOf(name)+1];
const uuid=value=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
if(!["--check","--prepare","--execute"].includes(mode))throw new Error("Use --check --subject UUID. Preparation/execution require founder approval; see docs/ADMIN_OPERATIONS.md.");
if(process.env.DATABASE_URL||process.env.SUPABASE_DB_URL||process.env.DOCKER_HOST)throw new Error("Remote connection overrides forbidden");
if(existsSync(".tmp/oryqen-local-dev/supabase/.temp/project-ref"))throw new Error("Hosted-linked directory forbidden");
checkLocalDocker();
function sql(statement){const result=spawnSync("docker",["exec","-i","supabase_db_oryqen-local-dev","psql","-U","postgres","-d","postgres","-X","-t","-A","-v","ON_ERROR_STOP=1"],{input:statement,encoding:"utf8",windowsHide:true,timeout:15000});if(result.status!==0)throw new Error("Local bootstrap precondition or transaction failed. No success is assumed; inspect the documented prerequisites.");return result.stdout.trim();}
function verify(subject){if(!uuid(subject))throw new Error("An exact existing subject UUID is required");const raw=sql(`select jsonb_build_object('subjectId',u.id,'emailConfirmed',u.email_confirmed_at is not null,'activeProfile',exists(select 1 from private.profiles p where p.id=u.id and p.account_state='active' and p.deleted_at is null),'verifiedTotp',exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified' and f.factor_type='totp')) from auth.users u where u.id='${subject}' and not coalesce(u.is_anonymous,false);`);if(!raw)throw new Error("Selected local account not found");return JSON.parse(raw);}
if(mode==="--check"){console.log(JSON.stringify(verify(arg("--subject"))));}
else if(mode==="--prepare"){
 const subject=arg("--subject"),approval=arg("--approval-ref");if(!/^[A-Za-z0-9._-]{10,100}$/.test(approval??""))throw new Error("Explicit founder approval reference required");
 const status=verify(subject);if(!status.emailConfirmed||!status.activeProfile||!status.verifiedTotp)throw new Error("Confirmed email, active profile and verified TOTP are required before preparation");
 const grant={version:1,subjectId:subject,approvalRef:approval,nonce:randomUUID(),preparedAt:new Date().toISOString(),authorizationExpiresAt:new Date(Date.now()+600000).toISOString(),ownerExpiresAt:new Date(Date.now()+90*86400000).toISOString()};
 mkdirSync(".tmp/admin-bootstrap",{recursive:true});const file=path.resolve(`.tmp/admin-bootstrap/${grant.nonce}.json`);writeFileSync(file,JSON.stringify(grant,null,2),{flag:"wx"});console.log(`Prepared one-use LOCAL authorization: ${file}. Expires in ten minutes; no privilege granted.`);
}else{
 const file=path.resolve(arg("--authorization")??"");const allowed=path.resolve(".tmp/admin-bootstrap")+path.sep;if(!file.startsWith(allowed))throw new Error("Authorization must be inside the local bootstrap directory");const grant=JSON.parse(readFileSync(file,"utf8"));
 const elapsed=Date.now()-Date.parse(grant.preparedAt);if(grant.version!==1||!uuid(grant.subjectId)||!uuid(grant.nonce)||!Number.isFinite(elapsed)||elapsed<0||elapsed>600000||Date.parse(grant.authorizationExpiresAt)!==Date.parse(grant.preparedAt)+600000||!Number.isFinite(Date.parse(grant.ownerExpiresAt))||Date.parse(grant.ownerExpiresAt)>Date.now()+90*86400000||Date.parse(grant.ownerExpiresAt)<=Date.now()||!/^[A-Za-z0-9._-]{10,100}$/.test(grant.approvalRef??""))throw new Error("Authorization invalid or expired; obtain fresh explicit approval");
 const until=new Date(grant.ownerExpiresAt).toISOString(),authorizationUntil=new Date(grant.authorizationExpiresAt).toISOString();
 // Recheck identity and factor in the SAME transaction as the one-time grant.
 sql(`begin; select pg_advisory_xact_lock(10202026); do $$ begin
 if current_user<>'postgres' or clock_timestamp()>='${authorizationUntil}'::timestamptz then raise exception 'Bootstrap authorization invalid';end if;
 if exists(select 1 from private.admin_roles) or exists(select 1 from private.admin_audit where action='bootstrap_owner') then raise exception 'First owner already bootstrapped';end if;
 if not exists(select 1 from auth.users u join private.profiles p on p.id=u.id where u.id='${grant.subjectId}' and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and p.account_state='active' and p.deleted_at is null) or not exists(select 1 from auth.mfa_factors where user_id='${grant.subjectId}' and status='verified' and factor_type='totp') then raise exception 'Identity or MFA prerequisite missing';end if;
 insert into private.admin_roles(subject_id,role,revision,expires_at) values('${grant.subjectId}','owner',1,'${until}');
 insert into private.admin_audit(actor_id,action,target_id,revision,reason,changes) values('${grant.subjectId}','bootstrap_owner','${grant.subjectId}',1,'Founder-authorized local owner bootstrap',jsonb_build_object('approvalRef','${grant.approvalRef}','nonce','${grant.nonce}','authorizationExpiresAt','${authorizationUntil}','ownerExpiresAt','${until}'));
 end $$; commit;`);
 console.log("Local owner grant recorded with immutable audit. Authorization consumed; owner assignment expires after 90 days and requires an independent owner for renewal. No hosted changes.");
}

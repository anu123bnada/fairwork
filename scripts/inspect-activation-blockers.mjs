// Read-only hosted metadata/configuration inspection. Never exports user data.
// The isolated comparison config is NEVER pushed and is not application config.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
if (!process.argv.includes('--network')) { console.log('PLAN_ONLY: --network enables read-only metadata inspection.'); process.exit(0); }
const env = { ...(existsSync('.env.local') ? parseEnv(readFileSync('.env.local','utf8')) : {}), ...process.env };
const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
const ref = readFileSync('supabase/.temp/project-ref','utf8').trim();
if (project.protocol !== 'https:' || project.hostname !== `${ref}.supabase.co`) throw new Error('Linked project mismatch');
const directory = `test-results/activation-blockers-${Date.now()}`;
mkdirSync(`${directory}/probe/supabase`, { recursive:true });
function cli(args) {
  const result = spawnSync(path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe'), [...args,'--output-format','json'], { env, encoding:'utf8', input:'', timeout:45000, windowsHide:true });
  if(result.status!==0) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}
function list(value) { return Array.isArray(value) ? value : value && typeof value==='object' ? Object.values(value).filter(Array.isArray).flat() : []; }
const projects=cli(['projects','list']), organizations=cli(['orgs','list']);
const selected=list(projects).find(p=>p.id===ref||p.ref===ref);
const organization=list(organizations).find(o=>o.id===selected?.organization_id||o.slug===selected?.organization_slug);
const report={capturedAt:new Date().toISOString(),projectFingerprint:createHash('sha256').update(project.origin).digest('hex'),mode:'READ_ONLY_NO_EXPORT_NO_MUTATION',organizationMatched:Boolean(organization),subscriptionPlan:['free','pro','team','enterprise'].includes(organization?.plan)?organization.plan:'UNVERIFIED',auth:{},database:null};
// Force visible differences for settings that equal normal local defaults.
// Invalid comparison endpoints prevent mistaking this file for deployment config.
const config=readFileSync('supabase/config.toml','utf8')
  .replace(/^site_url\s*=.*$/m,'site_url = "https://not-a-deployment.invalid"')
  .replace(/^additional_redirect_urls\s*=.*$/m,'additional_redirect_urls = ["https://not-a-deployment.invalid/confirmation"]')
  .replace(/^enable_signup = false$/gm,'enable_signup = true')
  .replace(/^enable_anonymous_sign_ins = false$/m,'enable_anonymous_sign_ins = true')
  .replace(/^enable_confirmations = true$/gm,'enable_confirmations = false')
  .replace(/^enroll_enabled = true$/m,'enroll_enabled = false')
  .replace(/^verify_enabled = true$/m,'verify_enabled = false');
writeFileSync(`${directory}/probe/supabase/config.toml`,config+'\n[auth.email.smtp]\nenabled = true\nhost = "not-a-mail-server.invalid"\nport = 587\nuser = "comparison-only"\npass = "not-a-credential"\nadmin_email = "comparison@example.invalid"\nsender_name = "Read only comparison"\n');
const diff=cli(['config','diff','--project-ref',ref,'--workdir',path.resolve(`${directory}/probe`)]);
const changes=Array.isArray(diff?.changes)?diff.changes:[];
const remote=key=>changes.find(c=>c.path?.join('.')===key)?.remote;
const boolean=key=>typeof remote(key)==='boolean'?remote(key):'UNVERIFIED';
const site=remote('auth.site_url');
let siteParsed;
try { if(typeof site==='string') siteParsed=new URL(site); } catch { /* Value never logged. */ }
report.auth={
  diffRetrieved:diff!==null,
  siteURLObserved:Boolean(siteParsed), siteURLIsHTTPS:siteParsed?siteParsed.protocol==='https:':'UNVERIFIED',
  siteURLIsLoopback:siteParsed?['localhost','127.0.0.1','[::1]'].includes(siteParsed.hostname):'UNVERIFIED',
  siteURLMatchesConfiguredAppOrigin:siteParsed?siteParsed.origin===env.APP_ORIGIN:'UNVERIFIED',
  redirectCount:Array.isArray(remote('auth.additional_redirect_urls'))?remote('auth.additional_redirect_urls').length:'UNVERIFIED',
  currentAppConfirmationRedirectAllowed:Array.isArray(remote('auth.additional_redirect_urls'))?remote('auth.additional_redirect_urls').includes(`${env.APP_ORIGIN}/auth/confirm`):'UNVERIFIED',
  globalSignupEnabled:boolean('auth.enable_signup'), anonymousSignupEnabled:boolean('auth.enable_anonymous_sign_ins'),
  emailConfirmationRequired:boolean('auth.email.enable_confirmations'),
  minimumPasswordLength:typeof remote('auth.minimum_password_length')==='number'?remote('auth.minimum_password_length'):'UNVERIFIED',
  securePasswordChange:boolean('auth.email.secure_password_change'),
  totpEnrollmentEnabled:boolean('auth.mfa.totp.enroll_enabled'),totpVerificationEnabled:boolean('auth.mfa.totp.verify_enabled'),
  customSMTPEnabled:boolean('auth.email.smtp.enabled'),
  smtpHostConfigured:typeof remote('auth.email.smtp.host')==='string'?remote('auth.email.smtp.host').length>0:'UNVERIFIED',
  confirmationTemplate:'UNVERIFIED', actualEmailDelivery:'NOT_TESTED', realMFAChallenge:'NOT_TESTED',
};
const sql=`begin transaction read only;
set local statement_timeout='15s';
select current_setting('server_version_num')::integer as server_version_num,
 jsonb_build_object('auth_users',(select count(*) from auth.users),'auth_identities',(select count(*) from auth.identities),'auth_mfa_factors',(select count(*) from auth.mfa_factors),'storage_buckets',(select count(*) from storage.buckets),'storage_objects',(select count(*) from storage.objects),'vault_secrets',(select count(*) from vault.secrets)) as aggregate_counts,
 (select rolbypassrls from pg_roles where rolname=current_user) as inspection_role_bypasses_rls,
 (select coalesce(jsonb_agg(jsonb_build_object('name',extname,'version',extversion) order by extname),'[]') from pg_extension) as extensions,
 (select count(*)::integer from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage')) as managed_schema_policy_count,
 (select count(*)::integer from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage') and not t.tgisinternal) as managed_schema_noninternal_trigger_count,
 (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'forceRLS',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner)) order by c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r') as private_tables;
rollback;`;
writeFileSync(`${directory}/backup-catalog.sql`,sql);
const catalog=cli(['db','query','--linked','--file',`${directory}/backup-catalog.sql`]);
function visit(v){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(Number.isInteger(v.server_version_num))report.database=v;else Object.values(v).forEach(visit);}}
visit(catalog);
writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({report:`${directory}/report.json`,...report},null,2));

// Narrow LOCAL-only credential provisioning. No hosted links or admin grants.
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {checkLocalDocker} from './local-development-runtime.mjs';
if(process.env.DATABASE_URL||process.env.SUPABASE_DB_URL||process.env.DOCKER_HOST)throw new Error('Remote overrides forbidden');
if(existsSync('.tmp/oryqen-local-dev/supabase/.temp/project-ref'))throw new Error('Linked project forbidden');
checkLocalDocker();
const file=path.resolve('.tmp/oryqen-local-dev/telemetry.json');
for(const item of [path.dirname(file),file])if(existsSync(item)&&lstatSync(item).isSymbolicLink())throw new Error('Linked credential paths forbidden');
const prior=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
const password=prior?.password??randomBytes(32).toString('hex');
if(!/^[a-f0-9]{64}$/.test(password))throw new Error('Unexpected local telemetry credential format');
if(!prior){mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,JSON.stringify({version:1,password}),{flag:'wx',mode:0o600});}
// Replace all explicit/inherited access with owner and SYSTEM only; verify before
// enabling LOGIN. File contents and connection credentials never enter logs.
const acl=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',`
$ErrorActionPreference='Stop'
$path=$env:ORYQEN_LOCAL_CREDENTIAL_PATH
$owner=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$system=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
& icacls $path /inheritance:r /grant:r ('*'+$owner.Value+':F') '*S-1-5-18:F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Credential permission update failed'}
foreach($existing in @((Get-Acl -LiteralPath $path).Access)){
 $sid=$existing.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
 if($sid -notin @($owner.Value,$system.Value)){
  & icacls $path /remove ('*'+$sid) | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Unexpected credential reader removal failed'}
 }
}
$verified=Get-Acl -LiteralPath $path
if(-not $verified.AreAccessRulesProtected){throw 'Credential ACL not protected'}
foreach($rule in $verified.Access){if($rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($owner.Value,$system.Value)){throw 'Unexpected credential reader'}}
`],{encoding:'utf8',windowsHide:true,env:{...process.env,ORYQEN_LOCAL_CREDENTIAL_PATH:file}});
if(acl.status!==0){console.error(acl.error?.code??acl.stderr.replaceAll(password,'[redacted]'));throw new Error('Credential ACL verification required before app startup');}
const result=spawnSync('docker',['exec','-i','supabase_db_oryqen-local-dev','psql','-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1'],{input:`set log_statement='none';set log_min_error_statement='panic';begin;do $$ begin if not exists(select 1 from pg_roles where rolname='oryqen_telemetry_writer' and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolinherit) then raise exception 'Telemetry migration required';end if;end $$;alter role oryqen_telemetry_writer login password '${password}';grant connect on database postgres to oryqen_telemetry_writer;commit;`,encoding:'utf8',windowsHide:true,timeout:15000});
if(result.status!==0){console.error((result.stderr??'').replaceAll(password,'[redacted]').slice(-1200));throw new Error('Local telemetry provisioning failed; credential redacted');}
console.log('LOCAL append-only telemetry writer configured. Credential remains in ignored local config; no value printed. Restart the guarded app launcher to use it.');

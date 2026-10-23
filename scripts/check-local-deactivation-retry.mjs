// Rollback-only synthetic diagnostic; never hosted. Does not restore an account.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { checkLocalDocker } from './local-development-runtime.mjs';
checkLocalDocker();
const source=process.argv[2];
if(!/^test-results\/local-real-\d+\/results\.json$/.test(source??''))throw new Error('Explicit local test evidence required');
const worker=JSON.parse(readFileSync(source,'utf8')).accountsRetained.find(a=>a.role==='worker')?.id;
if(!/^[0-9a-f-]{36}$/.test(worker??''))throw new Error('Synthetic account reference unavailable');
const sql=`begin;
select set_config('request.jwt.claims',jsonb_build_object('sub','${worker}','role','authenticated','aal','aal2','is_anonymous',false)::text,true) is not null;
do $$ declare body jsonb;result jsonb;begin
 select jsonb_build_object('confirmation','DEACTIVATE','expectedRevision',previous_revision,'idempotencyKey',request_id) into body from private.account_deactivations where actor_id='${worker}';
 if body is null then raise exception 'Missing retained synthetic receipt';end if;
 begin result:=api.deactivate_account(body);raise notice 'RETRY_PASS';exception when others then if sqlerrm in ('NOT_FOUND','ACTION_FORBIDDEN','IDEMPOTENCY_CONFLICT','VALIDATION_FAILED','MFA_REQUIRED') then raise notice 'RETRY_%',sqlerrm;else raise notice 'RETRY_UNEXPECTED_ERROR';end if;end;
end $$;rollback;`;
const r=spawnSync('docker',['exec','-i','supabase_db_oryqen-local-dev','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:sql,encoding:'utf8',windowsHide:true,timeout:30000});
const lines=r.stderr.match(/RETRY_[A-Z_]+/g)??[];console.log(JSON.stringify({rollbackOnly:true,result:lines}));
if(r.status!==0||!lines.includes('RETRY_PASS'))process.exitCode=1;

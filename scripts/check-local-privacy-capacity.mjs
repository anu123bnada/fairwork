// Rollback-only PostgreSQL boundary fixture, separate from real Auth/API journeys.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkLocalDocker } from './local-development-runtime.mjs';
checkLocalDocker();
const sql=`begin;
do $$ declare actor uuid; wanted uuid; begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='202610180009') then raise exception 'Privacy guard migration required';end if;
 select id into actor from private.profiles where display_name='Synthetic local worker' and account_state='active' limit 1;
 if actor is null then raise exception 'Run the synthetic real account journey first';end if;
 insert into private.privacy_requests(subject_id,kind,scope,idempotency_key) values(actor,'access','Synthetic rollback-only boundary fixture',gen_random_uuid()) returning id into wanted;
 insert into private.privacy_request_events(request_id,revision,actor_id,status,note,idempotency_key) select wanted,n,actor,'in_review','Synthetic rollback-only fixture',gen_random_uuid() from generate_series(1,19) n;
 begin
  insert into private.privacy_request_events(request_id,revision,actor_id,status,note,idempotency_key) values(wanted,20,actor,'in_review','This must be denied',gen_random_uuid());
  raise exception 'Terminal capacity guard did not reject';
 exception when raise_exception then if sqlerrm<>'VERSION_CONFLICT' then raise;end if;end;
 insert into private.privacy_request_events(request_id,revision,actor_id,status,note,idempotency_key) values(wanted,20,actor,'withdrawn','Owner final-slot withdrawal fixture',gen_random_uuid());
 if (select count(*) from private.privacy_request_events where request_id=wanted)<>20 then raise exception 'Wrong history length';end if;
end $$;
rollback;`;
const result=spawnSync('docker',['exec','-i','supabase_db_oryqen-local-dev','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:sql,encoding:'utf8',windowsHide:true,timeout:60000});
if(result.status!==0)throw new Error('Local privacy boundary assertion failed; no raw database content printed');
const directory=`test-results/privacy-capacity-${Date.now()}`;mkdirSync(directory,{recursive:true});
const results={fixture:'rollback-only real PostgreSQL; not an authenticated API journey',requiredMigration:'202610180009',checks:[{check:'Final audit slot rejects nonterminal review',status:'PASS'},{check:'Final slot permits owner withdrawal without exceeding history bound',status:'PASS'}]};
writeFileSync(`${directory}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({status:'PASS',checks:2,evidence:directory}));

// Called by the guarded real local harness; all identities use actual Auth/MFA.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect as baseExpect } from '@playwright/test';
// The local stack and the browser share one machine, so first loads (the local app runs in development mode and compiles each route on demand) can take much longer than the default 5 s.
const expect = baseExpect.configure({ timeout: 60000 });
export async function localPrivacyJourney({worker, employer, operator, approver, localSql, record, evidence, origin}) {
 const ownerPath='/api/v1/privacy-requests',reviewPath='/api/v1/operator/privacy-requests';
 const must=(ok,label)=>{if(!ok)throw new Error(label);record(label);};
 async function call(actor,path,body,key=randomUUID(),statuses=[200]) {
  const response=await actor.context.request.fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Idempotency-Key':key},...(body?{data:body}:{}),maxRedirects:0});
  if(!statuses.includes(response.status()))throw new Error(`Privacy request HTTP ${response.status()}`);
  if(response.headers()['cache-control']!=='private, no-store')throw new Error('Privacy response must not be cached');
  return {status:response.status(),data:(await response.json()).data};
 }
 const anonymous={context:await worker.context.browser().newContext()};
 await call(anonymous,ownerPath,undefined,undefined,[401]);await anonymous.context.close();
 await call(operator,reviewPath,undefined,undefined,[403]);
 record('Privacy endpoints deny unauthenticated and unassigned MFA users');
 const body={operation:'create',kind:'access',scope:'Synthetic local privacy acceptance request: my account information'};
 await call(worker,ownerPath,{...body,subjectId:employer.id},undefined,[422]);
 const key=randomUUID(), created=(await call(worker,ownerPath,body,key)).data;
 must(created.status==='received'&&created.history.length===0,'Privacy request is persisted without fabricating fulfillment');
 const duplicate=(await call(worker,ownerPath,body,key)).data;
 must(created.requestId===duplicate.requestId,'Duplicate privacy submission returns the same persistent request');
 await call(worker,ownerPath,{...body,scope:'Changed request'},key,[409]);
 await call(employer,ownerPath+`?requestId=${created.requestId}`,undefined,undefined,[404]);
 await call(employer,ownerPath,{operation:'withdraw',requestId:created.requestId,expectedRevision:0},undefined,[404]);
 must(!(await call(employer,ownerPath)).data.items.some(i=>i.requestId===created.requestId),'Other accounts cannot list, read or withdraw a private request');
 let sql=readFileSync('scripts/day2-bootstrap-capability.sql','utf8').replaceAll("'authority_operator'","'privacy_operator'");
 const assignment=randomUUID();
 for(const [name,value]of Object.entries({operator_id:approver.id,target_subject:operator.id,operator_factor:approver.factorId,subject_factor:operator.factorId,assignment_id:assignment})) {
  if(!/^[0-9a-f-]{36}$/.test(value))throw new Error('Invalid local privacy identity');
  sql=sql.replace(`${name} uuid := null;`,`${name} uuid := '${value}';`);
 }
 sql=sql.replace('approval_record text := null;',"approval_record text := 'Owner-authorized local synthetic privacy tracking test; no data purge or hosted authority';")
  .replace('approved_until timestamptz := null;',"approved_until timestamptz := transaction_timestamp()+interval '1 day';");
 localSql(sql);
 const reviewed=(await call(operator,reviewPath+`?requestId=${created.requestId}`)).data;
 must(reviewed.scope===body.scope,'Audited one-day privacy capability opens only the request review surface');
 const lowAssurance={context:await worker.context.browser().newContext()};
 await call(lowAssurance,'/api/v1/auth/sign-in',{email:operator.email,password:operator.password});
 await call(lowAssurance,reviewPath,undefined,undefined,[403]);
 await lowAssurance.context.close();
 record('Assigned privacy operator without a verified MFA session is denied');
 const own=(await call(operator,ownerPath,body)).data;
 await call(operator,reviewPath+`?requestId=${own.requestId}`,undefined,undefined,[404]);
 record('Privacy operator cannot review its own request');
 const review={operation:'review',requestId:created.requestId,expectedRevision:0,status:'in_review',note:'Synthetic review only; no personal data exported',evidenceRef:null};
 await call(worker,reviewPath,review,undefined,[403]);
 await call(operator,reviewPath,{...review,status:'fulfilled',evidenceRef:null},undefined,[422]);
 await call(operator,reviewPath,{...review,status:'fulfilled',evidenceRef:'synthetic:not-fulfilled'},undefined,[409]);
 const reviewKey=randomUUID();await call(operator,reviewPath,review,reviewKey);
 must((await call(operator,reviewPath,review,reviewKey)).data.history.length===1,'Review retries preserve one immutable event');
 const outcomes=await Promise.all(['needs_information','declined'].map(status=>call(operator,reviewPath,{...review,expectedRevision:1,status},undefined,[200,409])));
 must(outcomes.filter(x=>x.status===200).length===1&&outcomes.filter(x=>x.status===409).length===1,'Concurrent conflicting privacy reviews commit exactly one revision');
 const current=(await call(worker,ownerPath+`?requestId=${created.requestId}`)).data;
 must(current.history.length===2&&current.revision===2,'Owner can reopen the immutable privacy review timeline');
 // Deletion requests are deliberately only requests, not account mutation.
 const removal=(await call(worker,ownerPath,{operation:'create',kind:'deletion',scope:'Synthetic retention review, not permission to delete data'})).data;
 await call(worker,ownerPath,{operation:'withdraw',requestId:removal.requestId,expectedRevision:0});
 await call(operator,reviewPath,{...review,requestId:removal.requestId,expectedRevision:1},undefined,[409]);
 record('Owner withdrawal is terminal and no account or underlying record is deleted');
 const page=worker.context.pages()[0];await page.goto(origin+'/app/settings');
 await page.getByText('Manage privacy requests',{exact:true}).click();
 const region=page.getByRole('region',{name:'Privacy requests',exact:true});
 await expect(region.getByText(body.scope,{exact:true})).toBeVisible({timeout:20000});
 await region.getByText('Request audit timeline',{exact:true}).first().click();
 await page.screenshot({path:`${evidence}/privacy-requests.png`,fullPage:true});
 must(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Real privacy requests render on mobile without horizontal overflow');
 localSql(`begin;update private.capability_assignments set revoked_at=transaction_timestamp() where id='${assignment}';
 insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values('${approver.id}','bootstrap_capability','${assignment}',gen_random_uuid(),array['revoked_at'],'offline_capability_bootstrap','authority');commit;`);
 await call(operator,reviewPath,undefined,undefined,[403]);
 await call(operator,reviewPath,{...review,expectedRevision:2},undefined,[403]);
 record('Revoked privacy capability immediately loses queue and review access');
 const guard=localSql(`begin;select case when not has_table_privilege('authenticated','private.privacy_requests','SELECT') and not has_table_privilege('fw_privacy_exec','private.profiles','SELECT') and not has_table_privilege('fw_privacy_exec','private.work_record_versions','SELECT') and not (select rolbypassrls or rolcanlogin from pg_roles where rolname='fw_privacy_exec') then 'PASS' else 'FAIL' end;
 do $$ begin begin update private.privacy_requests set scope='unauthorized rewrite' where id='${created.requestId}';raise exception 'immutable guard failed';exception when raise_exception then if sqlerrm<>'ACTION_FORBIDDEN' then raise;end if;end;end $$;rollback;`);
 must(guard.includes('PASS')&&!guard.includes('FAIL'),'Real PostgreSQL denies direct client access, unrelated operator data and history rewrites');
 return created.requestId;
}

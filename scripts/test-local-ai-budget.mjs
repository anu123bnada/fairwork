// REAL local Auth/PostgREST/PostgreSQL. No AI provider call and no forged JWT.
import { chromium, expect } from '@playwright/test';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkLocalDocker } from './local-development-runtime.mjs';
import { redactStartupOutput } from './local-development-diagnostics.mjs';
checkLocalDocker();
const origin='http://127.0.0.1:3100', api='http://127.0.0.1:55421', mail='http://127.0.0.1:55424';
const directory=`test-results/ai-budget-real-${Date.now()}`, results=[];
mkdirSync(directory,{recursive:true});
const pass=check=>{results.push({check,status:'PASS'});console.log(`PASS: ${check}`);};
const browser=await chromium.launch(), context=await browser.newContext({viewport:{width:390,height:844}});
async function post(url,data,status=200) {
 const response=await context.request.post(origin+url,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data});
 const json=await response.json();if(response.status()!==status)throw Error(`${url}: ${response.status()} ${json.error?.code??''}`);return json.data;
}
try {
 const email=`ai-budget-${randomUUID()}@example.test`, password=randomBytes(24).toString('base64url');
 await post('/api/v1/auth/register',{email,password});
 let confirmation;
 for(let i=0;i<30;i++) {
  const list=await fetch(mail+'/api/v1/messages').then(r=>r.json());
  const entry=list.messages.find(m=>m.To.some(t=>t.Address===email));
  if(entry){const item=await fetch(mail+'/api/v1/message/'+entry.ID).then(r=>r.json());confirmation=new URL(item.HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'));break;}
  await new Promise(r=>setTimeout(r,500));
 }
 if(confirmation?.origin!==origin)throw Error('Missing canonical local confirmation');
 await post('/api/v1/auth/confirm',{tokenHash:new URLSearchParams(confirmation.hash.slice(1)).get('token_hash')});
 await post('/api/v1/me',{displayName:'Synthetic local AI budget test',locale:'en',timeZone:'Asia/Colombo'});
 const cli=spawnSync(path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe'),['status','--workdir',path.resolve('.tmp/oryqen-local-dev'),'-o','json'],{encoding:'utf8',windowsHide:true});
 if(cli.status!==0)throw Error('Local status unavailable');
 const config=JSON.parse(cli.stdout);if(config.API_URL!==api)throw Error('Non-local API refused');
 const key=config.ANON_KEY;
 const login=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 if(!login.ok)throw Error('Local real token login failed');
 const session=await login.json();
 const body={provider:'openai',model:'gpt-4o-mini',noticeVersion:'offer-analysis.v1',inputHash:'a'.repeat(64),consent:true,processingRegion:'Synthetic local test only',dataUse:'No provider called by this test',policyHash:'b'.repeat(64)};
 async function rpc(request,token=session.access_token) {
  const r=await fetch(api+'/rest/v1/rpc/authorize_ai_transmission',{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json','Content-Profile':'api'},body:JSON.stringify({request})});
  return {status:r.status,json:await r.json()};
 }
 if((await rpc(body,key)).status<400)throw Error('Anonymous budget admission accepted');
 if((await rpc({...body,actorId:randomUUID()})).json.message!=='VALIDATION_FAILED')throw Error('Forged actor accepted');
 if((await rpc({...body,consent:false})).json.message!=='VALIDATION_FAILED')throw Error('Missing consent accepted');
 pass('Real PostgREST denies anonymous admission, forged identity and missing consent');
 const concurrent=await Promise.all(Array.from({length:4},()=>rpc(body)));
 if(concurrent.filter(r=>r.status===200).length!==3||concurrent.filter(r=>r.json.message==='RATE_LIMITED').length!==1)throw Error('Concurrent per-account budget failed');
 pass('PostgreSQL serializes four concurrent admissions: three allowed, one rate-limited');
 if((await rpc(body)).json.message!=='RATE_LIMITED')throw Error('Durable limit bypassed');
 pass('Subsequent independent HTTP request remains rate-limited');
 const page=await context.newPage();await page.goto(origin+'/app/add-offer');
 await expect(page.getByRole('region',{name:'Optional AI analysis'})).toContainText('Live AI is not configured');
 await page.getByLabel('Paste offer text').fill('Role: Technician\nSalary: LKR 80000 monthly\n40 hours per week\nNo training fee applies.');
 await page.getByRole('button',{name:'Suggest terms with local rules'}).click();
 await page.getByText('Enter known offer details',{exact:true}).click();
 await expect(page.getByLabel('Pay amount')).toHaveValue('80000');
 await expect(page.getByLabel('Expected hours per week')).toHaveValue('40');
 await expect(page.getByRole('region',{name:'Rule-based considerations'})).toContainText('training fee');
 await page.screenshot({path:directory+'/rule-suggestions.png',fullPage:true});
 pass('Real browser fills reviewed rule-based candidates and truthfully marks live AI unavailable');
 await post('/api/v1/auth/sign-out',{});
}catch(error){const reason=redactStartupOutput(error.message);results.push({check:'local AI boundary',status:'FAIL',reason});console.error(reason);process.exitCode=1;}
finally{await browser.close();writeFileSync(directory+'/results.json',JSON.stringify({environment:'REAL LOCAL SERVICES; NO AI PROVIDER CALLED',results},null,2));console.log(directory);}

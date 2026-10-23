import { chromium, expect } from '@playwright/test';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkLocalDocker } from './local-development-runtime.mjs';
import { redactStartupOutput } from './local-development-diagnostics.mjs';
checkLocalDocker();
const origin='http://127.0.0.1:3100', mailbox='http://127.0.0.1:55424';
const results=[], directory=`test-results/recovery-real-${Date.now()}`;
mkdirSync(directory,{recursive:true});
const pass=check=>{results.push({check,status:'PASS'});console.log(`PASS: ${check}`);};
const browser=await chromium.launch(), context=await browser.newContext({viewport:{width:390,height:844}});
context.setDefaultTimeout(30000);
context.setDefaultNavigationTimeout(60000);
async function api(path,body,status=200) {
 const r=await context.request.post(origin+path,{headers:{Origin:origin,'Idempotency-Key':randomUUID()},data:body});
 const d=await r.json();if(r.status()!==status)throw Error(`${path}: ${r.status()} ${d.error?.code??''}`);return d.data;
}
async function link(email,subject) {
 for(let i=0;i<30;i++) {
  const list=await fetch(mailbox+'/api/v1/messages').then(r=>r.json());
  const item=list.messages.find(m=>m.Subject.includes(subject)&&m.To.some(t=>t.Address===email));
  if(item){const d=await fetch(mailbox+'/api/v1/message/'+item.ID).then(r=>r.json());return d.HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&');}
  await new Promise(r=>setTimeout(r,500));
 }throw Error('Expected real local email was not delivered');
}
function code(secret) {
 const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';const bits=[...secret].map(c=>chars.indexOf(c).toString(2).padStart(5,'0')).join('');
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))), step=Buffer.alloc(8);step.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const digest=createHmac('sha1',key).update(step).digest();return ((digest.readUInt32BE(digest.at(-1)&15)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
try {
 const email=`recovery-${randomUUID()}@example.test`, password=randomBytes(24).toString('base64url'), nextPassword=randomBytes(24).toString('base64url');
 await api('/api/v1/auth/register',{email,password});
 const confirmation=new URL(await link(email,'Confirm'));
 if(confirmation.origin!==origin)throw Error('Unexpected confirmation origin');
 await api('/api/v1/auth/confirm',{tokenHash:new URLSearchParams(confirmation.hash.slice(1)).get('token_hash')});
 await api('/api/v1/me',{displayName:'Synthetic recovery account',locale:'en',timeZone:'Asia/Colombo'});
 const factor=await api('/api/v1/auth/mfa',{action:'enroll'});
 await api('/api/v1/auth/mfa',{action:'verify',factorId:factor.factorId,code:code(factor.secret)});
 await api('/api/v1/auth/sign-out',{});
 const page=await context.newPage();await page.goto(origin+'/forgot-password');
 await page.getByLabel('Email address').fill(email);await page.getByRole('button',{name:'Send recovery email'}).click();
 await expect(page.getByRole('status')).toContainText('check its inbox');pass('Real browser recovery request returns non-enumerating response');
 const recovery=new URL(await link(email,'Recover'));
 if(recovery.origin!==origin||recovery.pathname!=='/auth/recover'||!recovery.hash.startsWith('#token_hash='))throw Error('Recovery template/redirect mismatch');
 await page.goto(recovery.href);pass('Recovery email uses canonical fragment link without bearer token in HTTP URL');
 const tokenHash=new URLSearchParams(recovery.hash.slice(1)).get('token_hash');
 await page.getByRole('button',{name:'Confirm recovery link'}).click();await expect(page.getByLabel('Authenticator code')).toBeVisible();
 await api('/api/v1/auth/password',{password:nextPassword},403);pass('Email recovery cannot bypass existing MFA');
 await api('/api/v1/auth/recovery/confirm',{tokenHash},401);pass('Consumed recovery token replay denied');
 // A fresh TOTP time step avoids replaying the enrollment verification code.
 const wait=30500-(Date.now()%30000);await new Promise(r=>setTimeout(r,wait));
 await page.getByLabel('Authenticator code').fill(code(factor.secret));await page.getByRole('button',{name:'Verify authenticator'}).click();
 await expect(page.getByLabel('New password',{exact:true})).toBeVisible();
 await page.getByLabel('New password',{exact:true}).fill(nextPassword);await page.getByLabel('Confirm new password').fill(nextPassword);
 await page.getByRole('button',{name:'Save new password'}).click();await expect(page.getByRole('status')).toContainText('password was changed');
 await page.screenshot({path:directory+'/recovered.png',fullPage:true});
 await api('/api/v1/auth/sign-in',{email,password},401);await api('/api/v1/auth/sign-in',{email,password:nextPassword});
 pass('Real password changed; previous password denied and replacement signs in');
 await api('/api/v1/auth/password',{password},403);pass('New password sign-in still requires MFA for another password change');
 await api('/api/v1/auth/sign-out',{});
}catch(error){const reason=redactStartupOutput(error.message);results.push({check:'real recovery',status:'FAIL',reason});console.error(reason);process.exitCode=1;}
finally{await browser.close();writeFileSync(directory+'/results.json',JSON.stringify({environment:'REAL LOCAL SERVICES',results},null,2));console.log(directory);}

// Installs the LOCAL PWA into a separate Chrome profile on this Windows machine.
// No hosted access, production installer, default browser profile or fake sessions.
import { chromium, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkLocalDocker } from './local-development-runtime.mjs';
checkLocalDocker();
const origin='http://127.0.0.1:3100', manifestId=`${origin}/`;
const evidence=`test-results/windows-pwa-${Date.now()}`;
mkdirSync(evidence,{recursive:true});
const results=[];let context;let stage='startup';
const record=check=>{results.push({check,status:'PASS'});console.log(`PASS: ${check}`);};
// Uninstall coverage must never touch the founder's existing installed profile.
const rehearsal=process.argv.includes('--rehearsal');
const profile=path.resolve(rehearsal?`.tmp/windows-pwa-rehearsal-${Date.now()}`:'.tmp/windows-pwa-profile');
const launch=()=>chromium.launchPersistentContext(profile,{channel:'chrome',headless:false,viewport:{width:430,height:900},args:['--no-first-run'],timeout:60000});
async function install(cdp){
 const args={manifestId,installUrlOrBundleUrl:`${origin}/sign-in`};
 try{await cdp.send('PWA.install',args);}catch(error){
  // Chrome DevTools' own PWA implementation retries this specific transient
  // fetch failure once. A second failure remains a failed installation.
  // https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/src/McpContext.ts
  if(!String(error.message).includes("Couldn't fetch install info"))throw error;
  console.log('Chrome install-info fetch failed; retrying once');
  await cdp.send('PWA.install',args);
 }
}
async function appPage(session,cdp){
 await cdp.send('PWA.launch',{manifestId,url:`${origin}/sign-in`});
 for(let attempt=0;attempt<50;attempt++){
  for(const page of session.pages()){
   // Chrome can replace the initial target during app navigation. Require the
   // actual local origin and standalone display rather than a stale target ID.
   if(page.url().startsWith(`${origin}/`)&&await page.evaluate(()=>matchMedia('(display-mode: standalone)').matches).catch(()=>false)){
    await page.waitForLoadState();return page;
   }
  }
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw new Error('Installed app window was not available');
}
try{
 if(!(await fetch(`${origin}/sign-in`)).ok)throw new Error('Start the local app on port 3100 first');
 context=await launch();
 context.setDefaultTimeout(30000);context.setDefaultNavigationTimeout(60000);
 let cdp=await context.browser().newBrowserCDPSession();
 const page=context.pages()[0]??await context.newPage();await page.goto(`${origin}/sign-in`);
 const pageCdp=await context.newCDPSession(page);
 const manifest=await pageCdp.send('Page.getAppManifest');
 if(manifest.errors.length||!manifest.data)throw new Error('Local manifest is not installable');
 await pageCdp.detach();
 let installed=false;
 try{await cdp.send('PWA.getOsAppState',{manifestId});installed=true;}catch{ /* Fresh isolated profile needs installation. */ }
 if(!installed)await install(cdp);
 await cdp.send('PWA.changeAppUserSettings',{manifestId,displayMode:'standalone'});
 const osState=await cdp.send('PWA.getOsAppState',{manifestId});
 writeFileSync(`${evidence}/os-state.json`,JSON.stringify(osState,null,2));
 record(installed?'Previously installed local PWA is present in its isolated Windows profile':'Chrome installed the loopback ORYQEN PWA into its isolated Windows profile');
 let app=await appPage(context,cdp);
 if(!await app.evaluate(()=>matchMedia('(display-mode: standalone)').matches))throw new Error('App did not launch in standalone mode');
 record('Installed Windows PWA launches in a standalone app window');
 stage='real registration';
 const email=`oryqen-windows-${randomUUID()}@example.test`,password=randomBytes(24).toString('base64url');
 await app.goto(`${origin}/register`);await app.getByLabel('Email address').fill(email);await app.getByLabel('Password',{exact:true}).fill(password);
 const registered=app.waitForResponse(r=>r.url().endsWith('/api/v1/auth/register'));await app.getByRole('button',{name:'Register with email'}).click();
 if((await registered).status()!==200)throw new Error('Registration did not succeed');
 let confirmation;
 for(let i=0;i<30;i++){
  const list=await fetch('http://127.0.0.1:55424/api/v1/messages').then(r=>r.json());
  const message=list.messages?.find(m=>m.To?.some(t=>t.Address===email));
  if(message){const detail=await fetch(`http://127.0.0.1:55424/api/v1/message/${message.ID}`).then(r=>r.json());confirmation=detail.HTML?.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;','&');break;}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(!confirmation||new URL(confirmation).origin!==origin||new URL(confirmation).pathname!=='/auth/confirm'||!new URL(confirmation).hash.startsWith('#token_hash='))throw new Error('Expected local confirmation not available');
 await app.goto(confirmation);await app.getByRole('button',{name:'Confirm my email'}).click();await app.waitForURL('**/register/profile');
 await app.getByLabel('Display name').fill('Synthetic Windows user');await app.getByRole('button',{name:'Create my profile'}).click();await app.waitForURL('**/app/intro-welcome');
 await app.goto(`${origin}/app/home`);await expect(app.getByRole('heading',{name:/Good morning, Synthetic/})).toBeVisible();
 record('Real registration, local email confirmation and authorized profile work inside the installed PWA');
 await app.screenshot({path:`${evidence}/signed-in.png`,fullPage:true});
 const offers=app.getByRole('region',{name:'Saved offers'});
 await context.setOffline(true);await offers.getByRole('button',{name:'Refresh offers'}).click();await expect(offers.getByRole('alert')).toBeVisible();
 await context.setOffline(false);await offers.getByRole('button',{name:'Refresh offers'}).click();await expect(offers.getByText('No saved offers are available in this workspace.')).toBeVisible();
 record('Installed PWA shows a real offline API error and recovers after reconnecting');
 await app.goto(`${origin}/app/settings`);await app.getByRole('button',{name:'Sign out',exact:true}).click();await app.waitForURL('**/sign-in');
 await app.getByLabel('Email address').fill(email);await app.getByLabel('Password',{exact:true}).fill(password);await app.getByRole('button',{name:'Continue securely'}).click();await app.waitForURL('**/app/intro-welcome');
 record('Installed PWA signs out and signs in through real Auth');
 stage='restart';await context.close();context=await launch();cdp=await context.browser().newBrowserCDPSession();
 await cdp.send('PWA.getOsAppState',{manifestId});app=await appPage(context,cdp);await app.goto(`${origin}/app/home`);
 await expect(app.getByRole('heading',{name:/Good morning, Synthetic/})).toBeVisible();record('Installed app and authenticated session survive closing and reopening Chrome');
 await app.goto(`${origin}/app/settings`);await app.goBack();await expect(app.getByRole('heading',{name:/Good morning, Synthetic/})).toBeVisible();record('Windows PWA back navigation returns to the authenticated home');
 await app.screenshot({path:`${evidence}/reopened.png`,fullPage:true});
 if(rehearsal){
  stage='isolated uninstall and reinstall';
  await cdp.send('PWA.uninstall',{manifestId});
  let stillInstalled=false;
  try{await cdp.send('PWA.getOsAppState',{manifestId});stillInstalled=true;}catch{ /* Expected after uninstall. */ }
  if(stillInstalled)throw new Error('Rehearsal PWA remained installed');
  record('Uninstall removes only the PWA in the newly created rehearsal profile');
  await install(cdp);
  await cdp.send('PWA.changeAppUserSettings',{manifestId,displayMode:'standalone'});
  app=await appPage(context,cdp);await app.goto(`${origin}/app/home`);
  await expect(app.getByRole('heading',{name:/Good morning, Synthetic/})).toBeVisible();
  record('Reinstall restores the standalone app with its persistent authorized profile');
 }
}catch(error){
 // Do not expose provider errors, email URLs, cookies or browser launch arguments.
 const reason=stage==='startup'?String(error.message).replace(/https?:\/\/[^\s)]+/g,'[URL]').slice(0,350):'The real browser assertion failed; credentials and confirmation links are withheld.';
 results.push({check:stage,status:'FAIL',reason});console.error(`FAIL: ${stage}: ${reason}`);process.exitCode=1;
}finally{
 await context?.close();
 writeFileSync(`${evidence}/results.json`,JSON.stringify({at:new Date().toISOString(),environment:'REAL LOCAL SERVICES + installed Chrome PWA on Windows',results,profile,limits:`Local loopback installation only. Requires Docker and the Next app. Not a native EXE, signed MSIX or hosted release. ${rehearsal?'Uninstall/reinstall restricted to this new rehearsal profile; founder installation untouched.':'No uninstall performed.'} Final installation, profile and synthetic account retained; no database deletion.`},null,2));
 console.log(`Evidence: ${evidence}/results.json`);
}

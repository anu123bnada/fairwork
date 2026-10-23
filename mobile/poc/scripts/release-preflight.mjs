// No build, key generation or connection. The debug transport cannot pass release gates.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const config=JSON.parse(readFileSync(path.join(root,'mobile/poc/capacitor.config.json'),'utf8'));
const brand=JSON.parse(readFileSync(path.join(root,'src/lib/brand/assets.json'),'utf8'));
const blocked=[];
if(config.server?.url)blocked.push('Existing Capacitor server.url is a debug live-reload transport; an approved production transport and HTTPS origin are required.');
if(config.appId==='org.fairwork.localpoc')blocked.push('Final application ID, distribution route and versioning require owner approval.');
if(!brand.identity)blocked.push('Approved master/logo derivatives are absent.');
if(!process.env.ORYQEN_ANDROID_KEYSTORE_PATH||!existsSync(process.env.ORYQEN_ANDROID_KEYSTORE_PATH))blocked.push('Owner-managed release/upload keystore is not configured; no key was generated.');
blocked.push('Physical-device signed-candidate acceptance and hosted Auth/API verification have not been performed.');
const gradle=readFileSync(path.join(root,'mobile/poc/android/app/build.gradle'),'utf8');
if(!gradle.includes('variantBuilder.enable = false'))throw new Error('STOP: debug project release guard changed; review required');
console.log(JSON.stringify({status:'NO-GO',releaseGuard:'PRESERVED',artifact:'DEBUG ONLY',blocked,actions:['Approve production transport and origin without static-exporting server routes.','Approve final ID/icons/version and signing-key custody.','Implement reviewed production configuration in the existing project; keep debug override separate.','Build signed release, inspect merged manifest/APK, then install on physical hardware and run real HTTPS two-account acceptance.']},null,2));
if(process.argv.includes('--require-ready'))process.exitCode=1;

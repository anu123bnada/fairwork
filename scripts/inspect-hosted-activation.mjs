// Read-only Management API queries and config/backup inventory; never prints raw responses.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { inventory, stageSQL, constraintSQL } from './activation-checks.mjs';
const env={...(existsSync('.env.local')?parseEnv(readFileSync('.env.local','utf8')):{}),...process.env};
inventory();
if (!process.argv.includes('--network')) { console.log('Read-only inspection requires --network; no network used.'); process.exit(0); }
const project=new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if(project.protocol!=='https:'||!project.hostname.endsWith('.supabase.co')||project.hostname.split('.')[0]!==readFileSync('supabase/.temp/project-ref','utf8').trim()) throw new Error('Linked project mismatch');
const report={capturedAt:new Date().toISOString(),projectFingerprint:createHash('sha256').update(project.origin).digest('hex'),mode:'READ_ONLY_NO_HOSTED_WRITES',checks:[]};
function cli(args){const r=spawnSync('node_modules/@supabase/cli-windows-x64/bin/supabase.exe',[...args,'--output-format','json'],{env,encoding:'utf8',windowsHide:true,timeout:45000,input:''});if(r.status!==0)return null;try{return JSON.parse(r.stdout);}catch{return null;}}
const config=cli(['config','diff']);
report.configDifferences=Array.isArray(config?.changes)?config.changes.filter(c=>c.path?.[0]==='auth'||c.path?.[0]==='api').map(c=>({path:c.path.join('.'),declared:c.declared,remote:typeof c.remote==='boolean'||typeof c.remote==='number'?c.remote:'[REDACTED]',sameAsLocal:JSON.stringify(c.local)===JSON.stringify(c.remote)})):null;
report.checks.push({name:'Configuration differences',status:report.configDifferences?'RETRIEVED_DIFF_ONLY':'UNVERIFIED'});
// Absence from a diff is NOT treated as full hosted configuration verification.
const backups=cli(['backups','list']);
report.backups={retrieved:backups!==null,pitrEnabled:typeof backups?.pitr_enabled==='boolean'?backups.pitr_enabled:null,walgEnabled:typeof backups?.walg_enabled==='boolean'?backups.walg_enabled:null,listedBackupCount:Array.isArray(backups?.backups)?backups.backups.length:null,restoreTested:false};
const stageArg=process.argv.find(a=>a.startsWith('--stage='));
const stage=stageArg?Number(stageArg.slice(8)):0;
if(!Number.isInteger(stage)||stage<0||stage>6)throw new Error('Stage must be 0..6');
for(const file of [...(stage===0?['foundation-preflight.sql']:[]),`stage-${stage}.sql`,`constraints-stage-${stage}.sql`]){
  if(!existsSync(`test-results/activation-plan/${file}`)){report.checks.push({name:file,status:'UNVERIFIED',assertions:[]});continue;}
  let expected=file==='foundation-preflight.sql'?readFileSync('scripts/day3-hosted-preflight.sql','utf8'):stageSQL(stage);
  let expectedCount=file==='foundation-preflight.sql'?10:[...expected.matchAll(/ as check_name/g)].length;
  if(file.startsWith('constraints-')) {
    const rows=[...readFileSync(`test-results/activation-plan/${file}`,'utf8').matchAll(/\('([a-z_]+)','([0-9a-f]{64})'\)/g)].map(m=>({name:m[1],hash:m[2]}));
    expected=constraintSQL(stage,rows);
    expectedCount=rows.length;
  }
  if(readFileSync(`test-results/activation-plan/${file}`,'utf8')!==expected) throw new Error('STOP: regenerate changed SQL assertions');
  const value=cli(['db','query','--linked','--file',`test-results/activation-plan/${file}`]);
  // Accept only assertion-shaped rows; unknown CLI envelopes remain unverified.
  const rows=[];
  const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(typeof v.check_name==='string'&&['PASS','FAIL'].includes(v.result))rows.push({check_name:v.check_name,result:v.result});else Object.values(v).forEach(visit);}};
  visit(value);
  report.checks.push({name:file,status:rows.length===expectedCount&&rows.every(r=>r.result==='PASS')?'PASS':rows.length?'FAIL':'UNVERIFIED',assertions:rows});
}
mkdirSync('test-results',{recursive:true});
const output=`test-results/hosted-activation-inspection-${Date.now()}.json`;
writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({report:output,...report},null,2));
if(report.checks.some(c=>['FAIL','UNVERIFIED'].includes(c.status)))process.exitCode=1;

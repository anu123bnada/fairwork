// Restart/durability check for an EXISTING successful native test fixture only.
// This does not test Supabase Auth, mint sessions, create users or touch hosted data.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';

const relative = process.argv[2];
if (!/^test-results[\\/]day7-postgres-\d+$/.test(relative ?? '')) throw new Error('An exact existing native fixture directory is required');
const parent = realpathSync('test-results');
const directory = realpathSync(relative);
const data = realpathSync(path.join(directory,'data'));
if (!directory.startsWith(parent+path.sep) || path.dirname(data)!==directory || existsSync(path.join(data,'postmaster.pid'))) throw new Error('Refusing outside path or running database');
const testLog=readFileSync(path.join(directory,'tests.log'),'utf8').replaceAll(String.fromCharCode(27),'').replace(/\[[0-9;]*m/g,'');
if (!/\b33 passed\b/.test(testLog) || !existsSync(path.join(directory,'stop.log'))) throw new Error('Successful 33-test native run and clean stop required');
const require=createRequire(path.resolve('test-results/day4-postgres-tools/package.json'));
const native=path.resolve(path.dirname(require.resolve('@embedded-postgres/windows-x64')),'..','native','bin');
const {Client}=require('pg');
const reserve=net.createServer();
await new Promise((resolve,reject)=>{reserve.once('error',reject);reserve.listen(0,'127.0.0.1',resolve);});
const port=reserve.address().port;
await new Promise(resolve=>reserve.close(resolve));
function control(action) {
  const args=['-D',data,'-w',...(action==='start'?['-l',path.join(directory,'durability-server.log'),'-o',`-h 127.0.0.1 -p ${port} -c cluster_name=fairwork_day4_disposable`]:['-m','fast']),action];
  const result=spawnSync(path.join(native,'pg_ctl.exe'),args,{encoding:'utf8',windowsHide:true,timeout:60000});
  if(result.status!==0)throw new Error(`Fixture ${action} failed; inspect local server log`);
}
async function snapshot() {
  const client=new Client({host:'127.0.0.1',port,user:'fixture_bootstrap',database:'postgres',password:'',connectionTimeoutMillis:5000});
  try {
    await client.connect();
    const {rows:[identity]}=await client.query("select current_setting('cluster_name') name, current_setting('server_version') version");
    if(identity.name!=='fairwork_day4_disposable')throw new Error('Wrong fixture cluster');
    await client.query('begin transaction isolation level repeatable read read only');
    await client.query("set local statement_timeout='30s'");
    const tables=(await client.query("select tablename from pg_tables where schemaname='private' order by tablename")).rows;
    if(!tables.some(t=>t.tablename==='work_cases')||!tables.some(t=>t.tablename==='work_passports'))throw new Error('Full migration fixture required');
    const result=[];
    for(const {tablename} of tables) {
      if(!/^[a-z_][a-z_0-9]*$/.test(tablename))throw new Error('Unexpected fixture table');
      const {rows:[row]}=await client.query(`select count(*)::int count, encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),''),'UTF8')),'hex') hash from private.${tablename} t`);
      result.push({table:tablename,...row});
    }
    await client.query('rollback');
    return {version:identity.version,tables:result};
  } finally {await client.end();}
}
let running=false;
try {
  control('start');running=true;
  const before=await snapshot();
  control('stop');running=false;
  control('start');running=true;
  const after=await snapshot();
  assert.deepEqual(after,before,'Committed private data changed across PostgreSQL restart');
  const report={capturedAt:new Date().toISOString(),status:'PASS',scope:'NATIVE_POSTGRESQL_FIXTURE_DURABILITY_NOT_REAL_AUTH',serverVersion:after.version,tableCount:after.tables.length,totalRows:after.tables.reduce((n,t)=>n+t.count,0),tables:after.tables};
  const file=path.join(directory,'track-a-durability.json');
  writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({file,status:report.status,scope:report.scope,serverVersion:report.serverVersion,tableCount:report.tableCount,totalRows:report.totalRows}));
} finally {if(running)control('stop');}

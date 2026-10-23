// Local services only. No hosted link/config/migration commands and no raw CLI credentials logged.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { dockerJSON, checkLocalDocker } from './local-development-runtime.mjs';
import { prepareGateway } from './local-development-gateway.mjs';
import { redactStartupOutput } from './local-development-diagnostics.mjs';

if (process.env.DOCKER_HOST || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL) throw new Error('Remove remote/container/database connection overrides');
const context = dockerJSON(['context','inspect'])[0];
if (!context?.Endpoints?.docker?.Host?.startsWith('npipe://')) throw new Error('Local Windows Docker Desktop context required');
const prepare = spawnSync(process.execPath,['scripts/prepare-local-development.mjs'],{encoding:'utf8',windowsHide:true});
if(prepare.status!==0) throw new Error('Local preparation failed; run prepare-local-development.mjs to inspect the non-secret error');
const workdir=path.resolve('.tmp/oryqen-local-dev');
if(existsSync(path.join(workdir,'supabase/.temp/project-ref')))throw new Error('Hosted-linked directory forbidden');
const networks=dockerJSON(['network','ls','--format','json'],true);
if(!networks.some(n=>n.Name==='oryqen-local-dev')) {
  const created=spawnSync('docker',['network','create','--driver','bridge','--internal','--label','oryqen.local=true','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1','oryqen-local-dev'],{encoding:'utf8',windowsHide:true});
  if(created.status!==0)throw new Error('Could not create dedicated local network');
}
const network=dockerJSON(['network','inspect','oryqen-local-dev'])[0];
if(network.Internal!==true||network.Labels?.['oryqen.local']!=='true'||network.Options?.['com.docker.network.bridge.host_binding_ipv4']!=='127.0.0.1')throw new Error('Existing network is not the reviewed isolated network');
prepareGateway(workdir);
const cli = path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
// A pinned volume is treated as a backup by the CLI. Start just PostgreSQL and
// apply pending local migrations before PostgREST checks that the api schema exists.
for (const args of [
  ['db','start','--workdir',workdir,'--network-id','oryqen-local-dev'],
  ['db','push','--local','--skip-vault','--yes','--workdir',workdir],
]) {
  const step = spawnSync(cli,args,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:300000});
  if (step.status !== 0) throw new Error(redactStartupOutput(`${step.stdout ?? ''}\n${step.stderr ?? ''}`).slice(-12000));
}
// CLI start returns early when a database-only container is already running.
// Preserve that container and its volume, then let start assemble the full stack.
const running = dockerJSON(['ps','--format','json'],true).map(c => c.Names);
if (!running.includes('supabase_auth_oryqen-local-dev') || !running.includes('supabase_rest_oryqen-local-dev')) {
  for (const args of [['stop','supabase_db_oryqen-local-dev'], ['rename','supabase_db_oryqen-local-dev',`oryqen-local-db-bootstrap-${Date.now()}`]]) {
    const step = spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:30000});
    if (step.status !== 0) throw new Error('Could not preserve database-only container; no cleanup attempted');
  }
}
console.log('Starting local PostgreSQL/Auth/API/mail services. Initial image downloads may take several minutes; credentials are suppressed. Database volume is pinned against CLI failure cleanup.');
const start=spawnSync(path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe'),['start','--workdir',workdir,'--network-id','oryqen-local-dev','--exclude','realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor'],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:900000});
if(start.status!==0) {
  console.error(redactStartupOutput(`${start.stdout ?? ''}\n${start.stderr ?? ''}`).slice(-16000));
  throw new Error(`Local service startup failed (${start.error?.code ?? start.status}); database volume retained`);
}
checkLocalDocker();
console.log('Local containers passed network/loopback/persistent-volume checks. Next: node scripts/run-local-development.mjs. Login and persistence still require real browser verification.');

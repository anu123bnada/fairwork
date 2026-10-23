// Starts Next only after local Supabase exists. Never reads/copies a hosted key into app env.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { localAppEnvironment } from './local-development-guard.mjs';
import { checkLocalDocker } from './local-development-runtime.mjs';
import { assertNoCompetingDevServer } from './local-development-server-guard.mjs';

await assertNoCompetingDevServer(3102, 'Stop the Android port 3102 development server first; two Next dev processes share generated files and can continuously reload pages. Keep database services running.');
const workdir = path.resolve('.tmp/oryqen-local-dev');
const config = path.join(workdir, 'supabase/config.toml');
if (!existsSync(config) || !/^project_id = "oryqen-local-dev"$/m.test(readFileSync(config,'utf8')) || existsSync(path.join(workdir,'supabase/.temp/project-ref'))) throw new Error('Prepare the unlinked local project first');
if (process.env.DOCKER_HOST || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL) throw new Error('STOP: remove remote/container/database connection overrides from this terminal');
checkLocalDocker();
const cli = path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const status = spawnSync(cli,['status','--workdir',workdir,'-o','json'],{encoding:'utf8',windowsHide:true,timeout:30000});
if(status.status!==0) throw new Error('Local Supabase is not ready; no application started and raw credentials suppressed');
let env;
try { env = localAppEnvironment(JSON.parse(status.stdout), process.env); }
catch { throw new Error('Local status must contain the expected loopback API URL and public anon/publishable key; no app started'); }
// Never inherit a remote telemetry destination into local development.
delete env.ORYQEN_TELEMETRY_DB_URL;
const telemetry=path.join(workdir,'telemetry.json');
if(existsSync(telemetry)){
 const value=JSON.parse(readFileSync(telemetry,'utf8'));
 if(value.version!==1||!/^[a-f0-9]{64}$/.test(value.password))throw new Error('Invalid local telemetry config');
 env.ORYQEN_TELEMETRY_DB_URL=`postgresql://oryqen_telemetry_writer:${value.password}@127.0.0.1:55422/postgres`;
}
// Next prefers process.env over .env.local. All application connection settings are overridden.
const child = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3100'],{env,stdio:'inherit',windowsHide:true});
child.on('error',()=>{console.error('Local Next process could not start');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));

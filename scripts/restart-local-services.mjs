// Preserve every existing container and volume while reloading local CLI config.
import { spawnSync } from 'node:child_process';
import { checkLocalDocker, dockerJSON } from './local-development-runtime.mjs';
checkLocalDocker();
const names = dockerJSON(['ps','--format','json'],true).map(c => c.Names).filter(n => /^supabase_[a-z_]+_oryqen-local-dev$/.test(n));
const stamp = Date.now();
for (const name of names) {
  for (const args of [['stop',name],['rename',name,`${name}-preserved-${stamp}`]]) {
    const result = spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:60000});
    if(result.status!==0) throw new Error(`Could not preserve ${name}; no cleanup performed`);
  }
}
const result = spawnSync(process.execPath,['scripts/start-local-development.mjs'],{stdio:'inherit',windowsHide:true});
process.exitCode = result.status ?? 1;

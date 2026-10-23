import { spawnSync } from 'node:child_process';
import { assertLocalDocker } from './local-development-guard.mjs';
export function dockerJSON(args, lines = false) {
  if (process.env.DOCKER_HOST) throw new Error('Remove Docker host override');
  const result = spawnSync('docker', args, {encoding:'utf8',windowsHide:true,timeout:30000});
  if(result.status!==0) throw new Error('Docker Desktop is unavailable or its local engine is not ready');
  try { return lines ? result.stdout.trim().split('\n').filter(Boolean).flatMap(line => JSON.parse(line)) : JSON.parse(result.stdout); } catch { throw new Error('Unexpected local Docker metadata'); }
}
export function checkLocalDocker() {
  const context = dockerJSON(['context','inspect'])[0];
  const network = dockerJSON(['network','inspect','oryqen-local-dev'])[0];
  const ids = Object.keys(network.Containers ?? {});
  if (!ids.length) throw new Error('No local development services running');
  const containers = dockerJSON(['inspect',...ids]);
  assertLocalDocker(context,network,containers);
  for (const name of ['supabase_db_oryqen-local-dev','supabase_auth_oryqen-local-dev','supabase_rest_oryqen-local-dev','supabase_kong_oryqen-local-dev','supabase_inbucket_oryqen-local-dev','oryqen-local-gateway']) {
    const container = containers.find(c => c.Name === `/${name}`);
    if (!container?.State?.Running || container.State.Health?.Status === 'unhealthy') throw new Error(`Local service not ready: ${name}`);
  }
  const relayNetwork = dockerJSON(['network','inspect','oryqen-local-loopback'])[0];
  const relay = containers.find(c => c.Name === '/oryqen-local-gateway');
  if (relayNetwork.Driver !== 'bridge' || relayNetwork.Internal || relayNetwork.Labels?.['oryqen.local'] !== 'true' || relayNetwork.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1' || Object.keys(relayNetwork.Containers ?? {}).some(id => id !== relay.Id)) throw new Error('Unexpected host-facing relay network');
}

// Docker Desktop does not publish ports on an internal-only network. Keep the
// services internal; a credential-free TCP relay alone joins the host-facing bridge.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dockerJSON } from './local-development-runtime.mjs';

export const gatewayName = 'oryqen-local-gateway';
export const gatewayNetwork = 'oryqen-local-loopback';
export const gatewayPorts = [55421, 55422, 55423, 55424];
export function prepareGateway(workdir) {
  const run = args => {
    const r = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    if (r.status !== 0) throw new Error(`Local Docker preparation failed: ${args[0]} ${args[1]}; no data removed`);
  };
  const networks = dockerJSON(['network', 'ls', '--format', 'json'], true);
  if (!networks.some(n => n.Name === gatewayNetwork)) run(['network', 'create', '--driver', 'bridge', '--label', 'oryqen.local=true', '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', gatewayNetwork]);
  const net = dockerJSON(['network', 'inspect', gatewayNetwork])[0];
  if (net.Driver !== 'bridge' || net.Internal || net.Labels?.['oryqen.local'] !== 'true' || net.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') throw new Error('Unexpected loopback relay network');
  const names = dockerJSON(['container', 'ls', '-a', '--format', 'json'], true).map(c => c.Names);
  // A stopped holder references the named volume. CLI failure cleanup cannot
  // delete a volume referenced by another container. Never remove this holder.
  const volume = 'supabase_db_oryqen-local-dev';
  if (!names.includes('oryqen-local-volume-guard')) {
    run(['volume', 'create', '--label', 'oryqen.local=true', volume]);
    run(['create', '--name', 'oryqen-local-volume-guard', '--label', 'oryqen.local=true', '--network', 'none', '--mount', `type=volume,source=${volume},target=/preserved,readonly`, '--entrypoint', '/bin/true', 'public.ecr.aws/supabase/postgres:17.11.0.004']);
  }
  const holder = dockerJSON(['inspect', 'oryqen-local-volume-guard'])[0];
  if (holder.State.Running || !holder.Mounts.some(m => m.Type === 'volume' && m.Name === volume && m.RW === false)) throw new Error('Database volume guard is not valid');
  const upstream = ['kong:8000', 'db:5432', 'studio:3000', 'inbucket:8025'];
  const config = `worker_processes 1;\npid /tmp/nginx.pid;\nerror_log /dev/stderr warn;\nevents { worker_connections 256; }\nstream { resolver 127.0.0.11 valid=5s ipv6=off;\n${gatewayPorts.map((port, i) => `server { listen ${port}; set $upstream supabase_${upstream[i].replace(':', '_oryqen-local-dev:')}; proxy_pass $upstream; }`).join('\n')}\n}\n`;
  const file = path.join(workdir, 'gateway.conf');
  if (existsSync(file) && readFileSync(file, 'utf8') !== config) throw new Error('Existing gateway configuration differs; preserve and review');
  if (!existsSync(file)) writeFileSync(file, config, { flag: 'wx' });
  if (!names.includes(gatewayName)) {
    // Match the service lifecycle after a Docker/Windows restart while still
    // respecting an intentional operator stop. No volume or network changes.
    run(['create', '--name', gatewayName, '--restart', 'unless-stopped', '--label', 'oryqen.local=true', '--network', gatewayNetwork, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--user', '65534:65534', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '--health-cmd', 'nc -z 127.0.0.1 55422', '--health-interval', '10s', ...gatewayPorts.flatMap(p => ['-p', `127.0.0.1:${p}:${p}`]), '--mount', `type=bind,source=${file},target=/gateway.conf,readonly`, '--entrypoint', 'nginx', 'public.ecr.aws/supabase/kong:2.8.1', '-e', '/dev/stderr', '-c', '/gateway.conf', '-g', 'daemon off;']);
    run(['network', 'connect', 'oryqen-local-dev', gatewayName]);
  }
  run(['start', gatewayName]);
}

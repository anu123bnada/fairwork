// Public local status fields only; never accept a service role or remote origin.
export function localAppEnvironment(status, inherited = {}) {
  const url = status.API_URL;
  const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (url !== 'http://127.0.0.1:55421' || typeof key !== 'string') throw new Error('Local backend required');
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey) {
    try { publicKey = key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; }
    catch { publicKey = false; }
  }
  if (!publicKey) throw new Error('Public anon key required');
  const env = { ...inherited };
  // Do not pass operational secrets, smoke switches or custom node injection to Next.
  for (const name of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY','DATABASE_URL','PGPASSWORD','FAIRWORK_BROWSER_SMOKE','FAIRWORK_ANDROID_POC','NODE_OPTIONS']) delete env[name];
  return {...env,NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,APP_ORIGIN:'http://127.0.0.1:3100',FAIRWORK_DATA_MODE:'synthetic',AUTH_REGISTRATION_ENABLED:'true'};
}

export function assertLocalDocker(context, network, containers) {
  if (!context?.Endpoints?.docker?.Host?.startsWith('npipe://')) throw new Error('Local Windows Docker context required');
  if (network?.Name !== 'oryqen-local-dev' || network.Internal !== true || network.Labels?.['oryqen.local'] !== 'true') throw new Error('Dedicated internal development network required');
  const ids = Object.keys(network.Containers ?? {});
  if (!ids.length || containers.length !== ids.length || containers.some(c => !ids.includes(c.Id))) throw new Error('Complete local container inventory required');
  for (const container of containers) {
    const relay = container.Name === '/oryqen-local-gateway';
    if (relay && (container.Config?.Labels?.['oryqen.local'] !== 'true' || container.HostConfig?.ReadonlyRootfs !== true || container.Config?.User !== '65534:65534' || !container.HostConfig?.CapDrop?.includes('ALL'))) throw new Error('Unsafe local relay');
    if (Object.keys(container.NetworkSettings?.Networks ?? {}).some(name => name !== network.Name && !(relay && name === 'oryqen-local-loopback'))) throw new Error('External container network detected');
    for (const bindings of Object.values(container.NetworkSettings?.Ports ?? {})) {
      if ((bindings ?? []).some(binding => !['127.0.0.1','::1'].includes(binding.HostIp))) throw new Error('Non-loopback published port detected');
    }
  }
  const database = containers.find(c => c.Name === '/supabase_db_oryqen-local-dev');
  if (!database?.Mounts?.some(m => m.Type === 'volume' && m.Destination === '/var/lib/postgresql/data')) throw new Error('Persistent development database volume not verified');
}

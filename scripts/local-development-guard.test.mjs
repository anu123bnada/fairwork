import test from 'node:test';
import assert from 'node:assert/strict';
import { localAppEnvironment, assertLocalDocker } from './local-development-guard.mjs';
import { redactStartupOutput } from './local-development-diagnostics.mjs';
const keyFor = role => `header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
test('rejects hosted, alternate local port, credential-bearing and absent endpoints',()=>{
  for(const url of ['https://example.supabase.co','http://127.0.0.1:54321','http://user:password@127.0.0.1:55421',undefined])assert.throws(()=>localAppEnvironment({API_URL:url,ANON_KEY:keyFor('anon')}));
});
test('rejects remote Docker, public port bindings, external networks and ephemeral DB',()=>{
  const context={Endpoints:{docker:{Host:'npipe:////./pipe/dockerDesktopLinuxEngine'}}};
  const network={Name:'oryqen-local-dev',Internal:true,Labels:{'oryqen.local':'true'},Containers:{db:{}}};
  const db={Id:'db',Name:'/supabase_db_oryqen-local-dev',NetworkSettings:{Networks:{'oryqen-local-dev':{}},Ports:{'5432/tcp':[{HostIp:'127.0.0.1'}]}},Mounts:[{Type:'volume',Destination:'/var/lib/postgresql/data'}]};
  assert.doesNotThrow(()=>assertLocalDocker(context,network,[db]));
  assert.throws(()=>assertLocalDocker({Endpoints:{docker:{Host:'ssh://remote'}}},network,[db]));
  assert.throws(()=>assertLocalDocker(context,{...network,Internal:false},[db]));
  assert.throws(()=>assertLocalDocker(context,network,[{...db,Mounts:[]}]));
  assert.throws(()=>assertLocalDocker(context,network,[{...db,NetworkSettings:{...db.NetworkSettings,Ports:{'5432/tcp':[{HostIp:'0.0.0.0'}]}}}]));
  assert.throws(()=>assertLocalDocker(context,network,[{...db,NetworkSettings:{...db.NetworkSettings,Networks:{'oryqen-local-dev':{},bridge:{}}}}]));
});
test('rejects service role, secret and malformed keys',()=>{
  for(const key of [keyFor('service_role'),'sb_secret_test','malformed',undefined])assert.throws(()=>localAppEnvironment({API_URL:'http://127.0.0.1:55421',ANON_KEY:key}));
});
test('overrides hosted application environment and strips operational secrets',()=>{
  const env=localAppEnvironment({API_URL:'http://127.0.0.1:55421',ANON_KEY:keyFor('anon')},{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'wrong',APP_ORIGIN:'https://example.invalid',SUPABASE_ACCESS_TOKEN:'secret',DATABASE_URL:'secret',NODE_OPTIONS:'injection',FAIRWORK_BROWSER_SMOKE:'1'});
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'http://127.0.0.1:55421');assert.equal(env.APP_ORIGIN,'http://127.0.0.1:3100');assert.equal(env.AUTH_REGISTRATION_ENABLED,'true');assert.equal(env.FAIRWORK_DATA_MODE,'synthetic');
  for(const key of ['SUPABASE_ACCESS_TOKEN','DATABASE_URL','NODE_OPTIONS','FAIRWORK_BROWSER_SMOKE'])assert.equal(env[key],undefined);
});
test('only the restricted named relay may join the loopback bridge',()=>{
  const context={Endpoints:{docker:{Host:'npipe:////./pipe/dockerDesktopLinuxEngine'}}};
  const network={Name:'oryqen-local-dev',Internal:true,Labels:{'oryqen.local':'true'},Containers:{db:{},relay:{}}};
  const db={Id:'db',Name:'/supabase_db_oryqen-local-dev',NetworkSettings:{Networks:{'oryqen-local-dev':{}},Ports:{}},Mounts:[{Type:'volume',Destination:'/var/lib/postgresql/data'}]};
  const relay={Id:'relay',Name:'/oryqen-local-gateway',Config:{User:'65534:65534',Labels:{'oryqen.local':'true'}},HostConfig:{ReadonlyRootfs:true,CapDrop:['ALL']},NetworkSettings:{Networks:{'oryqen-local-dev':{},'oryqen-local-loopback':{}},Ports:{'55421/tcp':[{HostIp:'127.0.0.1'}]}}};
  assert.doesNotThrow(()=>assertLocalDocker(context,network,[db,relay]));
  assert.throws(()=>assertLocalDocker(context,network,[db,{...relay,Name:'/supabase_auth_oryqen-local-dev'}]));
  assert.throws(()=>assertLocalDocker(context,network,[db,{...relay,Config:{...relay.Config,User:'root'}}]));
  assert.throws(()=>assertLocalDocker(context,network,[db,{...relay,HostConfig:{ReadonlyRootfs:false,CapDrop:['ALL']}}]));
  assert.throws(()=>assertLocalDocker(context,network,[db,{...relay,NetworkSettings:{...relay.NetworkSettings,Ports:{'55421/tcp':[{HostIp:'0.0.0.0'}]}}}]));
});
test('startup diagnostics preserve the error while redacting credentials',()=>{
  const output=redactStartupOutput('ECONNREFUSED 127.0.0.1:55422 postgres://user:private@localhost/db eyJprivate.payload.signature sb_secret_private password=private');
  assert.match(output,/ECONNREFUSED 127\.0\.0\.1:55422/);
  assert.doesNotMatch(output,/private/);
});

// Local artifacts only. Does not invoke the CLI or any hosted operation.
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inventory, stageSQL } from './activation-checks.mjs';
const directory = 'test-results/activation-plan';
mkdirSync(directory, { recursive:true });
const migrations = inventory();
const foundation = [
  ['202610070001_identity_foundation.sql','6d76bafdba1d8a4f61c9881068ac56b5071b51cb0212146c92bd4095824fc0a8'],
  ['202610080002_identity_auth_context.sql','22981389db01426a4136b11c22605b7ccf1f62e9c2cb55274ec524a190fa91b4'],
  ['202610090001_identity_rpc_execute.sql','c0292e724cf775811958afc783c0717db159958f02ffc9588376cfc30d5b3754'],
  ['202610090002_demo_authority.sql','8262978f89b735c6536ae1adf0250ed92e13f0407b1cf0630186c17f903960f6'],
];
for (const [file,hash] of foundation) if(createHash('sha256').update(readFileSync(`supabase/migrations/${file}`)).digest('hex')!==hash) throw new Error(`STOP: foundation hash changed: ${file}`);
const allNames=[...foundation.map(([name])=>name),...migrations.map(m=>m.name)];
if(JSON.stringify(readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())!==JSON.stringify(allNames)) throw new Error('STOP: unexpected migration inventory');
writeFileSync(`${directory}/inventory.json`, JSON.stringify(migrations,null,2));
for (let stage=0;stage<=6;stage++) writeFileSync(`${directory}/stage-${stage}.sql`, stageSQL(stage));
for (let stage=1;stage<=6;stage++) {
  const target=`${directory}/stage-${stage}/supabase`;
  mkdirSync(`${target}/migrations`,{recursive:true});
  const names=allNames.slice(0,4+stage);
  if(readdirSync(`${target}/migrations`).some(name=>!names.includes(name))) throw new Error('STOP: unexpected file in staged package');
  for(const name of names) writeFileSync(`${target}/migrations/${name}`,readFileSync(`supabase/migrations/${name}`));
  writeFileSync(`${target}/config.toml`,readFileSync('supabase/config.toml'));
}
writeFileSync(`${directory}/foundation-preflight.sql`, readFileSync('scripts/day3-hosted-preflight.sql'));
console.log(JSON.stringify({status:'LOCAL_ONLY_NO_HOSTED_WRITES',directory,migrations:migrations.map(({name,sha256})=>({name,sha256}))},null,2));

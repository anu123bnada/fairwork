// Read-only check: which api.* RPC functions the app calls exist on the Supabase project.
// Uses only the public (publishable) key; changes nothing. Usage:
//   node scripts/verify-staging-migrations.mjs            (reads NEXT_PUBLIC_SUPABASE_* from the environment or .env.local)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const env = { ...process.env };
for (const file of [".env.local", "../fairwork/.env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) { console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not found."); process.exit(2); }

const names = new Set();
const walk = dir => { for (const entry of readdirSync(dir)) { const p = join(dir, entry); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(p)) for (const m of readFileSync(p, "utf8").matchAll(/rpc\("([a-z_]+)"/g)) names.add(m[1]); } };
walk("src");

let missing = 0;
for (const name of [...names].sort()) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, "Content-Profile": "api", "Content-Type": "application/json" }, body: JSON.stringify({ request: {} }) });
  const body = await response.text();
  const absent = body.includes("PGRST202");
  if (absent) missing++;
  console.log(`${absent ? "MISSING" : "present"}  ${name}`);
}
console.log(missing ? `\n${missing} function(s) missing: apply the pending migrations (docs/STAGING_MIGRATION_RUNBOOK.md).` : "\nAll functions the app calls exist.");
process.exit(missing ? 1 : 0);

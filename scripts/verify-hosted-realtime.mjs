// Hosted two-account Realtime authorization check for the PROPOSED batch 7 section C. Run only AFTER the owner has approved and applied batch 7 to STAGING.
// It signs in two dedicated test accounts (hidden password prompts; nothing is printed or stored), tries to join each account's private channel and the other's, and
// optionally listens for signals. It never writes, publishes or reads records, and refuses any project except the staging project and loopback.
//
//   node scripts/verify-hosted-realtime.mjs --a-email a@example.test --b-email b@example.test [--listen 60]
//
// Public project settings come from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or --url / --key); these are the browser-visible values.
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";
import { checkRealtimeAuthorization, payloadViolations, TOPIC } from "./lib/realtime-authz-check.mjs";

const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : undefined; };
const url = arg("url") ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key = arg("key") ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
if (!/^(https:\/\/jpvgsmzomlmowarlfkdl\.supabase\.co|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/.test(url)) { console.error("Only the staging project or a loopback Supabase is allowed."); process.exit(2); }
if (!key) { console.error("Missing publishable key."); process.exit(2); }
if (!process.stdin.isTTY) { console.error("Run in an interactive terminal (hidden password prompts)."); process.exit(2); }

function ask(label, hidden) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = text => { if (text.includes(label)) process.stdout.write(text); };
    rl.question(`${label}: `, answer => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(answer.trim()); });
  });
}
const fresh = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(label) {
  const client = fresh();
  const email = arg(`${label}-email`) ?? await ask(`Account ${label.toUpperCase()} email`, false);
  const { data, error } = await client.auth.signInWithPassword({ email, password: await ask(`Account ${label.toUpperCase()} password (hidden)`, true) });
  if (error || !data.user) { console.error(`Sign-in failed for account ${label.toUpperCase()}.`); process.exit(1); }
  await client.realtime.setAuth(data.session.access_token);
  return { client, uid: data.user.id };
}
const a = await signIn("a"), b = await signIn("b");
const results = await checkRealtimeAuthorization({ a, b, anonymous: fresh() });
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);
let failed = results.filter(r => !r.pass).length;
const seconds = Number(arg("listen") ?? 0);
if (seconds > 0) {
  console.log(`Listening ${seconds}s on each account's own channel. Perform an action as account A that should notify B (for example activate a Passport share to B), then compare.`);
  const got = { a: [], b: [] };
  for (const [label, who] of [["a", a], ["b", b]]) who.client.channel(TOPIC(who.uid), { config: { private: true } }).on("broadcast", { event: "changed" }, m => got[label].push(m.payload)).subscribe();
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  const bad = payloadViolations([...got.a, ...got.b]);
  console.log(`Signals received: A=${got.a.length}, B=${got.b.length}; payload violations: ${bad.length}`);
  if (bad.length) failed += 1;
}
console.log(failed ? `${failed} check(s) FAILED` : "All checks passed");
process.exit(failed ? 1 : 0);

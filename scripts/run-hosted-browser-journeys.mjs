// Runs the authenticated browser journeys (tests/hosted) against staging as YOUR dedicated test account.
// The password is typed at a hidden prompt, passed to the child process through its environment only, and never printed or written to disk.
// Only the session cookie state goes to .tmp/hosted-auth/ (gitignored); it is deleted when the run ends.
//
//   node scripts/run-hosted-browser-journeys.mjs [--origin https://oryqen-staging.vercel.app] [--email you@example.test] [--writes] [--signout] [--create-profile]
//
// --create-profile completes the profile of a brand-new test account (display name only).
// Defaults are read-only. --writes allows one synthetic private offer draft. --signout adds a sign-in/sign-out journey of its own.
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { rmSync } from "node:fs";
import path from "node:path";

const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : undefined; };
const origin = arg("origin") ?? "https://oryqen-staging.vercel.app";
if (!/^(https:\/\/oryqen-staging\.vercel\.app|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/.test(origin)) { console.error("Only the staging origin or a loopback origin is allowed."); process.exit(2); }
if (!process.stdin.isTTY && !(process.env.ORYQEN_TEST_EMAIL && process.env.ORYQEN_TEST_PASSWORD)) { console.error("Run in an interactive terminal (hidden password prompt)."); process.exit(2); }

function ask(label, hidden) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = text => { if (text.includes(label)) process.stdout.write(text); };
    rl.question(`${label}: `, answer => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(answer.trim()); });
  });
}
const email = arg("email") ?? process.env.ORYQEN_TEST_EMAIL ?? await ask("Staging test account email", false);
const password = process.env.ORYQEN_TEST_PASSWORD ?? await ask("Password (hidden)", true);
const state = path.resolve(".tmp/hosted-auth/state.json");
const env = { ...process.env, ORYQEN_HOSTED_ORIGIN: origin, ORYQEN_HOSTED_STATE: state, ORYQEN_TEST_EMAIL: email, ORYQEN_TEST_PASSWORD: password,
  ORYQEN_HOSTED_WRITES: process.argv.includes("--writes") ? "1" : "0", ORYQEN_HOSTED_PROFILE: process.argv.includes("--create-profile") ? "1" : "0", ORYQEN_HOSTED_SIGNOUT: process.argv.includes("--signout") ? "1" : "0" };
const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.hosted.config.ts"], { env, stdio: "inherit" });
rmSync(path.dirname(state), { recursive: true, force: true });
process.exit(result.status ?? 1);

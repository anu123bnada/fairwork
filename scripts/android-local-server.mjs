import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { localAppEnvironment } from "./local-development-guard.mjs";
import { checkLocalDocker } from "./local-development-runtime.mjs";
import { assertNoCompetingDevServer } from "./local-development-server-guard.mjs";

// Local connectivity only. No hosted credentials, synthetic success routes,
// security bypasses, LAN binding, or production configuration changes.
// Both Next dev processes rewrite the same next-env.d.ts. Different distDir
// values do not isolate that file and can produce a continuous refresh loop.
await assertNoCompetingDevServer(3100, "Stop the local port 3100 development server before Android dev testing; shared Next generated files must have one writer. Keep database services running.");
try {
  await fetch("http://127.0.0.1:3102", { signal: AbortSignal.timeout(1000) });
  throw new Error("Port 3102 is occupied; refusing to use or stop its server.");
} catch (error) {
  if (error.message.startsWith("Port 3102")) throw error;
}
const originalConfig = readFileSync("tsconfig.json", "utf8");
const originalNextEnv = readFileSync("next-env.d.ts", "utf8");
let backend = { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", AUTH_REGISTRATION_ENABLED: "false" };
if (process.argv.includes("--real-local")) {
  if (process.env.DOCKER_HOST || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || existsSync(".tmp/oryqen-local-dev/supabase/.temp/project-ref")) throw new Error("Remote or linked configuration forbidden");
  checkLocalDocker();
  const result = spawnSync(path.resolve("node_modules/@supabase/cli-windows-x64/bin/supabase.exe"), ["status", "--workdir", path.resolve(".tmp/oryqen-local-dev"), "-o", "json"], { encoding: "utf8", windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error("Local Supabase unavailable; no credentials printed");
  backend = localAppEnvironment(JSON.parse(result.stdout), process.env);
}
function restoreGeneratedTypes() {
  const current = readFileSync("tsconfig.json", "utf8");
  if (current !== originalConfig) {
    const parsed = JSON.parse(current);
    parsed.include = parsed.include.filter(path => !path.startsWith("test-results/android-next/"));
    writeFileSync("tsconfig.json", JSON.stringify(parsed) === JSON.stringify(JSON.parse(originalConfig))
      ? originalConfig : JSON.stringify(parsed, null, 2) + "\n");
  }
  if (readFileSync("next-env.d.ts", "utf8").includes("test-results/android-next/")) {
    writeFileSync("next-env.d.ts", originalNextEnv);
  }
}
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3102"], {
  stdio: "inherit", windowsHide: true,
  env: { ...process.env, ...backend, APP_ORIGIN: "http://localhost:3102", FAIRWORK_ANDROID_POC: "1",
    FAIRWORK_DATA_MODE: "synthetic",
    FAIRWORK_LOCAL_OFFER_DEMO: "false", NEXT_TELEMETRY_DISABLED: "1" },
});
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { restoreGeneratedTypes(); process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());

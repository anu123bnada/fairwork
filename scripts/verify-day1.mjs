// Refresh read-only hosted evidence, then run the private local credential test.
// No migrations, grants, privileged keys or schema changes are performed here.
import { execFile, spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify, parseEnv } from "node:util";
import { join } from "node:path";
import { validCatalogReport } from "./day1-verification-inputs.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !["--check-only", "--public"].includes(arg))) throw new Error("Use no flags for full verification, --check-only for catalogs, or --public for anonymous checks.");
const env = parseEnv(readFileSync(join(root, ".env.local"), "utf8"));
const ref = readFileSync(join(root, "supabase/.temp/project-ref"), "utf8").trim();
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname !== `${ref}.supabase.co`) throw new Error("Linked project and application project differ. Stop and review configuration.");
const directory = join(root, "test-results");
mkdirSync(directory, { recursive: true });

async function query(script, reportName) {
  let result;
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [
      join(root, "node_modules/supabase/dist/supabase.js"), "db", "query", "--linked", "--file", join(root, "scripts", script),
    ], { cwd: root, windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 });
    result = JSON.parse(stdout);
    if (!Array.isArray(result.rows)) throw new Error("Missing rows");
  } catch {
    throw new Error(`Read-only ${script} failed. Check Supabase CLI login/access locally; no provider payload is printed.`);
  }
  const report = { projectRef: ref, timestamp: new Date().toISOString(), rows: result.rows };
  writeFileSync(join(directory, reportName), JSON.stringify(report, null, 2) + "\n");
  return report;
}

try {
  const history = await query("day1-repair-history.sql", "day1-hosted-history-current.json");
  const versions = new Map(history.rows.map(row => [row.version, row.recorded]));
  if (history.rows.length !== 4 || versions.size !== 4
    || versions.get("202610070001") !== true || versions.get("202610080002") !== true
    || versions.get("202610090001") !== true || versions.get("202610080001") !== false) {
    throw new Error("Migration history differs from the reviewed Day 1 state; stop without repairing history.");
  }
  console.log("PASS: Hosted migration history matches the completed repairs.");
  const rpc = await query("day1-rpc-execute-check.sql", "day1-hosted-rpc-current.json");
  const signatures = ["api.create_profile(jsonb)", "api.get_me(jsonb)", "api.update_profile(jsonb)"];
  if (rpc.rows.length !== 3 || new Set(rpc.rows.map(row => row.signature)).size !== 3
    || !rpc.rows.every(row => signatures.includes(row.signature) && row.result === "PASS"
      && row.authenticated_execute === true && row.internal_execute === true
      && row.anon_execute === false && row.service_role_execute === false && row.public_execute === false
      && Array.isArray(row.anon_set_role_paths) && row.anon_set_role_paths.length === 0
      && Array.isArray(row.service_role_set_role_paths) && row.service_role_set_role_paths.length === 0)) {
    throw new Error("RPC effective privileges failed; review the sanitized RPC report before testing accounts.");
  }
  console.log("PASS: All three RPCs retain only intended client access, with no prohibited role paths.");
  const catalog = await query("day1-hosted-catalog.sql", "day1-hosted-catalog-current.json");
  if (!validCatalogReport(catalog, ref)) throw new Error("The hosted catalog is incomplete or not all PASS.");
  console.log("PASS: All 16 hosted catalog checks; fresh evidence saved locally.");
  if (!args.includes("--check-only")) {
    const child = spawn(process.execPath, [join(root, "scripts/verify-day1-hosted.mjs"),
      `--catalog-report=${join(directory, "day1-hosted-catalog-current.json")}`,
      args.includes("--public") ? "--public" : "--wait-for-expiry",
    ], { cwd: root, stdio: "inherit", windowsHide: true });
    process.exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", code => resolve(code ?? 1));
    });
  }
} catch (error) {
  // Only this launcher's fixed messages are emitted; child provider output and
  // credentials are never interpolated into errors.
  console.error(error.message);
  process.exitCode = 1;
}

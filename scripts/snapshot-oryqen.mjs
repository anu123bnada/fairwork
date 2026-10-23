import { readdirSync, statSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

// Local, non-destructive source rollback. Never copy credentials or generated trees.
const root = process.cwd();
const destination = path.join(root, "test-results", `oryqen-rollback-${Date.now()}`);
const excluded = new Set([".git", "node_modules", ".next", ".tmp", ".gradle", "build", "test-results", "playwright-report", ".vercel", ".temp", ".branches"]);
const files = [];
function walk(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.isSymbolicLink()) continue;
    const source = path.join(directory, item.name);
    if (item.isDirectory()) { walk(source); continue; }
    if ((item.name.startsWith(".env") && item.name !== ".env.example") || /\.(jks|keystore|log|tsbuildinfo)$/.test(item.name) || item.name === "local.properties") continue;
    const relative = path.relative(root, source);
    const target = path.join(destination, "files", relative);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    files.push({ path: relative, bytes: statSync(source).size, sha256: createHash("sha256").update(readFileSync(source)).digest("hex") });
  }
}
walk(root);
const apk = path.join(root, "mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk");
if (existsSync(apk)) copyFileSync(apk, path.join(destination, "previous-debug.apk"));
writeFileSync(path.join(destination, "manifest.json"), JSON.stringify({ created: new Date().toISOString(), root, files }, null, 2));
console.log(JSON.stringify({ destination, sourceFiles: files.length, apkPreserved: existsSync(apk) }));

// Secrets scan over every git-tracked file (and the files git would add). Prints only the file, line and rule, never the matched value.
// Exit 1 when anything unexplained is found. Reviewed false positives live in scripts/secret-scan-allowlist.json with a reason each.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';

const rules = [
  { id: 'google-api-key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { id: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { id: 'private-key-block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/ },
  { id: 'jwk-private-d', pattern: /"d"\s*:\s*"[A-Za-z0-9_-]{40,}"/ },
  { id: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'stripe-live-key', pattern: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/ },
  { id: 'connection-string-password', pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:(?!\*+|<|\$|%|password|postgres@|\{)[^\s@/]{6,}@/i },
  { id: 'generic-secret-assignment', pattern: /\b(?:api[_-]?key|secret|token|password)\b["']?\s*[:=]\s*["'][A-Za-z0-9_\-+/=]{32,}["']/i },
  { id: 'supabase-service-role', pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/ },
];
const allowlist = existsSync('scripts/secret-scan-allowlist.json') ? JSON.parse(readFileSync('scripts/secret-scan-allowlist.json', 'utf8')) : [];
const allowed = (file, rule) => allowlist.some(entry => entry.rule === rule && (entry.path === file || (entry.prefix && file.startsWith(entry.prefix))));

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
const binary = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|exe|apk|aab|jar|zip|gz|7z|asar|node|wasm|mp4|mov|lock)$/i;
const findings = [];
let scanned = 0;
for (const file of files) {
  if (binary.test(file) || file.endsWith('package-lock.json') || !existsSync(file)) continue;
  let size; try { size = statSync(file).size; } catch { continue; }
  if (size > 2_000_000) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  scanned += 1;
  lines.forEach((line, index) => {
    if (line.length > 20000) return;
    for (const rule of rules) if (rule.pattern.test(line) && !allowed(file, rule.id)) findings.push({ file, line: index + 1, rule: rule.id });
  });
}
for (const finding of findings) console.log(`SECRET? ${finding.rule}  ${finding.file}:${finding.line}`);
console.log(`Scanned ${scanned} files with ${rules.length} rules: ${findings.length} unexplained finding(s).`);
if (findings.length) process.exitCode = 1;

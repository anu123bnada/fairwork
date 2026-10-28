// Navigation policy for the privileged shell. The ORYQEN origin is NOT compiled in: it is read from `app-config.json`, which `scripts/write-config.cjs` writes
// at build time from the ORYQEN_DESKTOP_ORIGIN environment variable (so a staging installer and a later production installer differ only in that file).
// There is no runtime environment override, so nothing a user's environment sets can widen what the shell may open.
const { readFileSync } = require('node:fs');
const path = require('node:path');

// An origin is acceptable only if it is exactly https://host[:port]: no credentials, path, query or fragment.
function parseOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.hostname.includes('.')) return null;
    return url.origin;
  } catch { return null; }
}

function loadOrigin(configPath = path.join(__dirname, 'app-config.json')) {
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    return typeof parsed?.origin === 'string' ? parseOrigin(parsed.origin) : null;
  } catch { return null; }
}

function createPolicy(origin) {
  return {
    ORIGIN: origin,
    internal(value) {
      if (!origin) return false;
      try { const url = new URL(value); return url.origin === origin && !url.username && !url.password; } catch { return false; }
    },
    external(value) {
      try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
    },
  };
}

module.exports = { parseOrigin, loadOrigin, createPolicy, ...createPolicy(loadOrigin()) };

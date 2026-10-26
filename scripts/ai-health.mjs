// Provider availability check for operators. It sends NO user data: it asks each configured provider whether the configured model exists
// and supports text generation (a metadata request that does not consume generation quota), then prints one verdict per provider.
//   node scripts/ai-health.mjs [--json]
// It never prints a key. A verdict is a point-in-time observation, not a promise that a later generation request will be served.
import nextEnv from '@next/env';
import { fileURLToPath } from 'node:url';

const TIMEOUT_MS = 8000;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,99}$/;

export function providersFromEnv(env) {
  const list = [];
  const primary = env.ORYQEN_AI_PROVIDER ?? 'gemini';
  const named = [primary, ...(env.ORYQEN_AI_FALLBACK_PROVIDERS ?? '').split(',').map(item => item.trim()).filter(Boolean)];
  for (const provider of [...new Set(named)]) {
    if (provider === 'gemini') list.push({ provider, role: provider === primary ? 'primary' : 'fallback', key: env.GEMINI_API_KEY || env.GOOGLE_API_KEY, model: env.GEMINI_MODEL });
    else if (provider === 'openai') list.push({ provider, role: provider === primary ? 'primary' : 'fallback', key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini' });
    else if (provider === 'selfhosted') list.push({ provider, role: provider === primary ? 'primary' : 'fallback', key: env.ORYQEN_SELFHOSTED_AI_KEY, model: env.ORYQEN_SELFHOSTED_AI_MODEL, baseUrl: env.ORYQEN_SELFHOSTED_AI_URL?.replace(/\/+$/, '') });
  }
  return list;
}

async function get(fetcher, url, headers) {
  const response = await fetcher(url, { headers, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  let body;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body };
}
const statusVerdict = status => status === 429 ? 'quota_or_rate_limited' : status === 404 ? 'model_not_found' : [400, 401, 403].includes(status) ? 'rejected' : status >= 500 ? 'provider_unavailable' : 'unexpected_response';

export async function probeProvider(entry, fetcher = fetch) {
  const base = { provider: entry.provider, role: entry.role, model: entry.model ?? null };
  if (!entry.model || !MODEL.test(entry.model)) return { ...base, verdict: 'not_configured', detail: 'no safe model name is set' };
  if (entry.provider !== 'selfhosted' && !entry.key) return { ...base, verdict: 'not_configured', detail: 'no credential is set' };
  try {
    if (entry.provider === 'gemini') {
      const { status, body } = await get(fetcher, `https://generativelanguage.googleapis.com/v1beta/models/${entry.model}`, { 'x-goog-api-key': entry.key });
      if (status !== 200) return { ...base, verdict: statusVerdict(status) };
      const methods = Array.isArray(body?.supportedGenerationMethods) ? body.supportedGenerationMethods : [];
      return methods.includes('generateContent') ? { ...base, verdict: 'available' } : { ...base, verdict: 'model_cannot_generate', detail: 'the model does not list generateContent' };
    }
    if (entry.provider === 'openai') {
      const { status } = await get(fetcher, `https://api.openai.com/v1/models/${entry.model}`, { Authorization: `Bearer ${entry.key}` });
      return { ...base, verdict: status === 200 ? 'available' : statusVerdict(status) };
    }
    let url;
    try { url = new URL(entry.baseUrl ?? ''); } catch { return { ...base, verdict: 'not_configured', detail: 'no valid base address is set' }; }
    if (!(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) return { ...base, verdict: 'not_configured', detail: 'the base address must be https, or loopback for local testing' };
    const { status, body } = await get(fetcher, `${entry.baseUrl}/v1/models`, entry.key ? { Authorization: `Bearer ${entry.key}` } : {});
    if (status !== 200) return { ...base, verdict: statusVerdict(status) };
    const ids = Array.isArray(body?.data) ? body.data.map(item => item?.id) : [];
    return ids.includes(entry.model) ? { ...base, verdict: 'available' } : { ...base, verdict: 'model_not_found', detail: 'the server does not list this model' };
  } catch (error) {
    return { ...base, verdict: error?.name === 'TimeoutError' ? 'timeout' : 'unreachable' };
  }
}

export async function probeAll(env, fetcher = fetch) {
  return Promise.all(providersFromEnv(env).map(entry => probeProvider(entry, fetcher)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const results = await probeAll(process.env);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ checkedAt: new Date().toISOString(), providerRequestMade: results.some(item => item.verdict !== 'not_configured'), userDataSent: false, results }, null, 2));
  else {
    console.log('AI provider availability (metadata requests only; no user data is sent)');
    for (const item of results) console.log(`  ${item.provider.padEnd(11)} ${item.role.padEnd(8)} ${String(item.model ?? '-').padEnd(26)} ${item.verdict}${item.detail ? ` (${item.detail})` : ''}`);
    if (!results.length) console.log('  no provider is named in the environment');
    console.log('\nThis does not enable AI. Real-user processing also needs ORYQEN_AI_ENABLED, the written policy approval and each person\'s consent.');
  }
  process.exitCode = results.length && results.every(item => item.verdict === 'available') ? 0 : 1;
}

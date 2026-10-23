// Local inventory only: never calls a provider, enables AI, or prints values.
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const names = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_MODEL',
  'ORYQEN_AI_ENABLED', 'ORYQEN_AI_POLICY_APPROVED', 'ORYQEN_AI_POLICY_APPROVAL_REF',
  'ORYQEN_AI_PROCESSING_REGION', 'ORYQEN_AI_DATA_USE'];
const checks = Object.fromEntries(names.map(name => [name,
  name.endsWith('_ENABLED') || name.endsWith('_APPROVED')
    ? process.env[name] === 'true' : Boolean(process.env[name]?.trim())]));
const provider = process.env.ORYQEN_AI_PROVIDER ?? 'gemini';
const missing = names.filter(name => !['GEMINI_API_KEY', 'GOOGLE_API_KEY'].includes(name) && !checks[name]);
if (!checks.GEMINI_API_KEY && !checks.GOOGLE_API_KEY) missing.unshift('GEMINI_API_KEY');
if (provider !== 'gemini') missing.push('ORYQEN_AI_PROVIDER (must select gemini for this check)');
if (checks.GEMINI_MODEL && (!/^gemini-[a-zA-Z0-9.-]+$/.test(process.env.GEMINI_MODEL) || process.env.GEMINI_MODEL.length > 100)) missing.push('GEMINI_MODEL (invalid format)');
for (const [name, min, max] of [['ORYQEN_AI_POLICY_APPROVAL_REF', 10, 200], ['ORYQEN_AI_PROCESSING_REGION', 1, 120], ['ORYQEN_AI_DATA_USE', 1, 1000]]) {
  const length = process.env[name]?.trim().length ?? 0;
  if (checks[name] && (length < min || length > max)) missing.push(`${name} (invalid length)`);
}
console.log(JSON.stringify({ status: missing.length ? 'BLOCKED' : 'CONFIGURATION_PRESENT_NOT_LIVE_VERIFIED', checks, missing,
  providerRequestMade: false, note: 'Presence checks do not verify credentials, model access, account tier, billing, regional processing or retention. Do not enable policy flags without explicit owner approval. Never paste keys into chat.' }, null, 2));
if (missing.length) process.exitCode = 1;

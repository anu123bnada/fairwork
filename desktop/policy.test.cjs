const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { parseOrigin, loadOrigin, createPolicy } = require('./policy.cjs');

const STAGING = 'https://oryqen-staging.vercel.app';
const configIn = body => { const dir = mkdtempSync(path.join(tmpdir(), 'oryqen-desktop-')); const file = path.join(dir, 'app-config.json'); writeFileSync(file, body); return file; };

test('only the exact configured HTTPS origin can navigate inside the privileged shell', () => {
  const policy = createPolicy(STAGING);
  assert.equal(policy.internal(`${STAGING}/auth/confirm`), true);
  for (const value of ['http://oryqen-staging.vercel.app', 'https://oryqen-staging.vercel.app.evil.test', 'https://user@oryqen-staging.vercel.app', 'https://oryqen.vercel.app', 'javascript:alert(1)', 'file:///etc/passwd', 'not a url']) assert.equal(policy.internal(value), false, value);
});
test('with no configured origin nothing is internal, so the shell cannot be pointed anywhere by accident', () => {
  const policy = createPolicy(null);
  for (const value of [STAGING, 'https://oryqen.vercel.app', 'http://localhost:3000']) assert.equal(policy.internal(value), false);
});
test('external browser only accepts HTTPS without credentials', () => {
  const { external } = createPolicy(STAGING);
  assert.equal(external('https://example.com/help'), true);
  for (const value of ['file:///a', 'javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) assert.equal(external(value), false);
});
test('an origin is accepted only as a plain https origin', () => {
  assert.equal(parseOrigin(STAGING), STAGING);
  assert.equal(parseOrigin(`${STAGING}/`), STAGING);
  for (const value of ['http://oryqen-staging.vercel.app', `${STAGING}/sign-in`, `${STAGING}?x=1`, `${STAGING}#a`, 'https://user:pw@oryqen-staging.vercel.app', 'https://localhost', 'ftp://x.example.com', '', 'javascript:alert(1)', undefined]) assert.equal(parseOrigin(value), null, String(value));
});
test('the configuration file is read from disk and a missing, broken or unsafe file yields no origin', () => {
  assert.equal(loadOrigin(configIn(JSON.stringify({ origin: STAGING }))), STAGING);
  assert.equal(loadOrigin(path.join(tmpdir(), 'does-not-exist-oryqen.json')), null);
  assert.equal(loadOrigin(configIn('{not json')), null);
  assert.equal(loadOrigin(configIn(JSON.stringify({ origin: 'http://evil.example.com' }))), null);
  assert.equal(loadOrigin(configIn(JSON.stringify({ origin: 42 }))), null);
});
test('the module has no runtime environment override', () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, 'policy.cjs'), 'utf8');
  assert.equal(/process\.env/.test(source.replace(/\/\/.*$/gm, '')), false);
});

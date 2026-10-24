const { test } = require('node:test');
const assert = require('node:assert/strict');
const { internal, external } = require('./policy.cjs');
test('only exact HTTPS production origin can navigate inside the privileged shell', () => {
  assert.equal(internal('https://oryqen.vercel.app/auth/confirm'), true);
  for (const value of ['http://oryqen.vercel.app', 'https://oryqen.vercel.app.evil.test', 'https://user@oryqen.vercel.app', 'javascript:alert(1)', 'file:///etc/passwd']) assert.equal(internal(value), false);
});
test('external browser only accepts HTTPS without credentials', () => {
  assert.equal(external('https://example.com/help'), true);
  for (const value of ['file:///a', 'javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) assert.equal(external(value), false);
});

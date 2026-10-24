const ORIGIN = 'https://oryqen.vercel.app';
function internal(value) {
  try { const url = new URL(value); return url.origin === ORIGIN && !url.username && !url.password; } catch { return false; }
}
function external(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
module.exports = { ORIGIN, internal, external };

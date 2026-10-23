export function redactStartupOutput(value) {
  return String(value ?? '')
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"<>]+/gi, '[URL redacted]')
    .replace(/eyJ[A-Za-z0-9_.-]+/g, '[JWT redacted]')
    .replace(/sb_[A-Za-z0-9_-]+/g, '[key redacted]')
    .replace(/((?:password|secret|token|api.?key)\s*[=:]\s*)[^\s,]+/gi, '$1[redacted]');
}

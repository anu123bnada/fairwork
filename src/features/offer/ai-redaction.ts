export const AI_REDACTION_VERSION = "offer-redaction.v1";
// Conservative minimization, not an anonymization guarantee. Names or unusual
// identifiers embedded in prose can remain; the user must inspect the preview.
export function redactOfferForAi(source: string): string {
 return source
  .replace(/^(\s*(?:full name|name|employee name|candidate name|address|home address|date of birth|dob|national id|passport number|bank account|account number|telephone|phone|mobile|contact)\s*[:=])[^\r\n]*/gim, "$1 [REDACTED]")
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED EMAIL]")
  .replace(/https?:\/\/[^\s<>]+/gi, "[REDACTED URL]")
  .replace(/\+(?:[0-9][\s().-]*){8,15}[0-9]/g, "[REDACTED PHONE]")
  .replace(/\b(?:AIza[\w-]{30,}|sk-[\w-]{16,})\b/g, "[REDACTED KEY]")
  .replace(/\b\d{9}[vVxX]\b|\b(?:19|20)\d{10}\b/g, "[REDACTED ID]");
}

import { distance, fold, registrable } from "@/features/scam/check";

// Domain and address helpers for recruiter verification. Pure functions; nothing here touches the network.

// Free mail services: an address there cannot be tied to an employer, whatever name appears before the @.
export const FREE_MAIL_DOMAINS = new Set(["gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "aol.com", "proton.me", "protonmail.com", "icloud.com", "me.com", "gmx.com", "gmx.net", "mail.com", "zoho.com", "yandex.com", "qq.com", "163.com", "rediffmail.com"]);

// Professional networks and social services. ORYQEN never reads pages there automatically: their terms restrict automated access
// and a profile page is not proof of identity or affiliation anyway.
export const NO_AUTOMATED_READING = ["linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com", "xing.com", "glassdoor.com", "indeed.com", "whatsapp.com", "t.me", "telegram.org", "tiktok.com"];
export const JOB_BOARDS = ["linkedin.com", "indeed.com", "glassdoor.com", "monster.com", "jobsnet.lk", "topjobs.lk", "xpress.jobs", "ikman.lk", "stepstone.de", "xing.com"];

export function normalizeHost(value: string): string | null {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return host && !host.includes(":") && host.includes(".") && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : null;
  } catch { return null; }
}
export function emailDomain(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  return email && at > 0 ? normalizeHost(email.slice(at + 1)) : null;
}
export const hostIn = (host: string, list: readonly string[]) => list.some(domain => host === domain || host.endsWith(`.${domain}`));
// A host belongs to a domain when it is that domain or any subdomain of it. "notacme.com" does not belong to "acme.com".
export const belongsTo = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
// Visually confusable but different registrable names (rn for m, 0 for o, one letter apart...), the common impersonation trick.
export function lookalike(host: string, domain: string): boolean {
  const a = registrable(host), b = registrable(domain);
  if (a === b) return false;
  const [left, right] = [a.split(".")[0]!, b.split(".")[0]!];
  return left.length >= 4 && right.length >= 4 && distance(fold(left), fold(right)) <= 1;
}
export const sameRegistrable = (a: string, b: string) => registrable(a) === registrable(b);

// Well-formed claim domain for an employer to publish proof under.
export function claimableDomain(value: string): string | null {
  const host = normalizeHost(value.trim());
  if (!host || host !== value.trim().toLowerCase() || host.length > 253 || hostIn(host, [...FREE_MAIL_DOMAINS])) return null;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host) ? host : null;
}

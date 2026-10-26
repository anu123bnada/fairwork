import "server-only";
import { getGleifRecord } from "@/server/research/gleif";
import { nameMatch } from "@/features/research/analysis";
import { fetchPublicText, resolveTxtRecords, type TextFetcher, type TxtResolver } from "@/server/net/public-network";
import { belongsTo, emailDomain, FREE_MAIL_DOMAINS, hostIn, JOB_BOARDS, lookalike, NO_AUTOMATED_READING, normalizeHost, sameRegistrable } from "@/features/recruiter/domain";
import type { Evidence, RecruiterResult } from "@/features/recruiter/schema";

// Evidence is read fresh every time a result is shown and is stamped with the time it was observed. Every check can fail on its own without
// breaking the others, and a failed or skipped check is reported as "not checked", never as support and never as a contradiction.
type Claim = RecruiterResult["claim"];
export type CompanyDomain = { domainId: string; domain: string; token: string };
export type EvidenceDeps = {
  now: () => Date; resolveTxt: TxtResolver; fetchText: TextFetcher;
  registryRecord: (lei: string) => Promise<{ legalName: string; otherNames: string[]; country: string | null; sourceUrl: string; entityStatus: string } | null>;
};
export const defaultEvidenceDeps: EvidenceDeps = {
  now: () => new Date(), resolveTxt: resolveTxtRecords, fetchText: fetchPublicText,
  registryRecord: async lei => { const record = await getGleifRecord(lei); return record ? { legalName: record.legalName, otherNames: record.otherNames, country: record.country, sourceUrl: record.sourceUrl, entityStatus: record.entityStatus } : null; },
};

const item = (value: Partial<Evidence> & Pick<Evidence, "id" | "area" | "source" | "effect" | "title" | "detail">): Evidence => ({ material: false, materialWhenConfirmed: false, sourceLabel: null, sourceUrl: null, observedAt: null, quote: null, ...value });
const stamp = (deps: EvidenceDeps) => deps.now().toISOString();
const withTimeout = <T>(promise: Promise<T>, ms: number) => Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

// Proof that an employer controls a domain: a TXT record at _oryqen-verification.<domain> or a file at /.well-known/oryqen-verification.txt,
// either of which must contain the exact token the employer's representative was given on ORYQEN.
export async function domainControl(domain: string, token: string, deps: Pick<EvidenceDeps, "resolveTxt" | "fetchText" | "now">): Promise<{ controlled: boolean; method: "dns" | "well-known" | null; observedAt: string }> {
  const expected = `oryqen-verification=${token}`;
  try {
    const records = await withTimeout(deps.resolveTxt(`_oryqen-verification.${domain}`), 5000);
    if (records.some(parts => parts.join("") === expected)) return { controlled: true, method: "dns", observedAt: deps.now().toISOString() };
  } catch { /* no record, or the lookup failed: try the file */ }
  try {
    const response = await withTimeout(deps.fetchText(new URL(`https://${domain}/.well-known/oryqen-verification.txt`), { timeoutMs: 5000, maxBytes: 512, userAgent: "ORYQEN-Verification/1", accept: "text/plain" }), 6500);
    if (response.status === 200 && (response.text.trim() === token || response.text.trim() === expected)) return { controlled: true, method: "well-known", observedAt: deps.now().toISOString() };
  } catch { /* unreachable or blocked */ }
  return { controlled: false, method: null, observedAt: deps.now().toISOString() };
}

export async function buildEvidence(claim: Claim, domains: CompanyDomain[], deps: EvidenceDeps = defaultEvidenceDeps): Promise<{ evidence: Evidence[]; verifiedDomains: string[] }> {
  const evidence: Evidence[] = [];
  const observed = stamp(deps);

  // 1. The employer the recruiter named.
  if (claim.companyId) evidence.push(item({ id: "employer-on-oryqen", area: "employer", source: "live_check", effect: "neutral", title: "The employer is an ORYQEN organization", detail: "ORYQEN holds a record of this organization with an approved representative who can confirm or dispute recruiters. That record was approved under ORYQEN's demonstration authority policy: it is not a verification of a real legal entity.", observedAt: observed }));
  else evidence.push(item({ id: "employer-not-on-oryqen", area: "employer", source: "not_checked", effect: "not_checked", title: "The employer has not been matched to an ORYQEN organization, so ORYQEN has no employer-controlled way to confirm this person", detail: "Without an organization on ORYQEN, only registry and domain evidence can be considered, and neither can say who the employer authorized.", observedAt: observed }));
  if (claim.registryLei) {
    try {
      const record = await withTimeout(deps.registryRecord(claim.registryLei), 8000);
      if (!record) evidence.push(item({ id: "registry", area: "employer", source: "registry", effect: "not_checked", title: "The linked registry record could not be found", detail: "The registry did not return the record you linked. It may have been withdrawn or the identifier may be wrong.", sourceLabel: "GLEIF Global LEI Index", observedAt: observed }));
      else {
        const match = nameMatch(claim.claimedEmployer, { legalName: record.legalName, otherNames: record.otherNames });
        const good = match === "exact" || match === "close";
        evidence.push(item({ id: "registry", area: "employer", source: "registry", effect: good ? "supports" : "neutral", title: good ? `A registry record exists for ${record.legalName}${record.country ? ` (${record.country})` : ""}` : `The linked registry record (${record.legalName}) does not clearly match the employer name given`, detail: `${good ? "The name matches the employer the recruiter named. " : "Check that you linked the right entity. "}A registry record shows an entity exists and is ${record.entityStatus.toLowerCase()}; it does not show who that entity employs or authorized. Many genuine employers have no record.`, sourceLabel: "GLEIF Global LEI Index", sourceUrl: record.sourceUrl, observedAt: observed }));
      }
    } catch { evidence.push(item({ id: "registry", area: "employer", source: "not_checked", effect: "not_checked", title: "The registry could not be reached", detail: "The linked registry record was not checked this time.", sourceLabel: "GLEIF Global LEI Index", observedAt: observed })); }
  }

  // 2. Domains the employer's representatives claim, proven live.
  const proofs = await Promise.all(domains.slice(0, 5).map(async domain => ({ domain, proof: await domainControl(domain.domain, domain.token, deps) })));
  const verifiedDomains: string[] = [];
  for (const { domain, proof } of proofs) {
    if (proof.controlled) {
      verifiedDomains.push(domain.domain);
      evidence.push(item({ id: `domain-${domain.domainId.slice(0, 8)}`, area: "domain", source: "live_check", effect: "supports", title: `${domain.domain} is controlled by the employer`, detail: `The employer's representative published the ORYQEN token ${proof.method === "dns" ? `in a DNS TXT record at _oryqen-verification.${domain.domain}` : `in a file at https://${domain.domain}/.well-known/oryqen-verification.txt`}, which only someone who controls the domain can do. Observed just now.`, sourceLabel: proof.method === "dns" ? "DNS TXT record" : "Employer's website", sourceUrl: proof.method === "well-known" ? `https://${domain.domain}/.well-known/oryqen-verification.txt` : null, observedAt: proof.observedAt }));
    } else evidence.push(item({ id: `domain-${domain.domainId.slice(0, 8)}`, area: "domain", source: "live_check", effect: "neutral", title: `${domain.domain} was claimed by the employer but ORYQEN could not see the proof just now`, detail: "The token was not found in DNS or at the well-known address, so this domain is not used as evidence.", observedAt: proof.observedAt }));
  }
  if (claim.companyId && !domains.length) evidence.push(item({ id: "domain-none", area: "domain", source: "not_checked", effect: "not_checked", title: "The employer has not published a verified email domain on ORYQEN", detail: "Without one, ORYQEN cannot tell whether the recruiter's address belongs to the employer.", observedAt: observed }));

  // 3. The recruiter's email address.
  const mailDomain = emailDomain(claim.email);
  if (!claim.email) evidence.push(item({ id: "email-none", area: "email", source: "not_checked", effect: "not_checked", title: "No business email address was given to check", detail: "Ask the recruiter for an address on the employer's own domain.", observedAt: observed }));
  else if (!mailDomain) evidence.push(item({ id: "email-invalid", area: "email", source: "user_supplied", effect: "not_checked", title: "The email address could not be read", detail: "It was not used as evidence.", observedAt: observed }));
  else if (hostIn(mailDomain, [...FREE_MAIL_DOMAINS])) evidence.push(item({ id: "email-free", area: "email", source: "live_check", effect: "neutral", title: `The address uses a free mail service (${mailDomain})`, detail: "An address at a free mail service cannot be tied to an employer, whatever name comes before the @. Many genuine recruiters still use them, so this alone proves nothing either way.", observedAt: observed }));
  else {
    const lookalikeOf = verifiedDomains.find(domain => lookalike(mailDomain, domain));
    if (lookalikeOf) evidence.push(item({ id: "email-lookalike", area: "email", source: "live_check", effect: "contradicts", material: true, title: `The address domain ${mailDomain} looks like the employer's ${lookalikeOf} but is a different domain`, detail: "Look-alike domains are a common way to impersonate a company. Do not reply or share documents until the employer confirms this address through a channel you found yourself.", observedAt: observed }));
    else if (verifiedDomains.some(domain => belongsTo(mailDomain, domain))) evidence.push(item({ id: "email-match", area: "email", source: "live_check", effect: "supports", title: `The address is on ${verifiedDomains.find(domain => belongsTo(mailDomain, domain))}, a domain the employer proved it controls`, detail: "This shows the address is on the employer's domain. It does not show the person using it was authorized to recruit; only the employer can confirm that.", observedAt: observed }));
    else if (verifiedDomains.length) evidence.push(item({ id: "email-mismatch", area: "email", source: "live_check", effect: "contradicts", materialWhenConfirmed: true, title: `The address domain ${mailDomain} is not one of the domains the employer proved it controls`, detail: "Recruitment agencies and group companies do use other domains. Ask the recruiter how they are connected to the employer and ask the employer to confirm.", observedAt: observed }));
    else {
      const site = claim.employerSite ? normalizeHost(claim.employerSite) : null;
      if (site && lookalike(mailDomain, site)) evidence.push(item({ id: "email-lookalike-site", area: "email", source: "user_supplied", effect: "contradicts", material: true, title: `The address domain ${mailDomain} looks like the website you gave (${site}) but is a different domain`, detail: "Look-alike domains are a common way to impersonate a company. Check the spelling of both and find the employer's real website yourself.", observedAt: observed }));
      else if (site && sameRegistrable(mailDomain, site)) evidence.push(item({ id: "email-site", area: "email", source: "user_supplied", effect: "neutral", title: `The address matches the website you supplied (${site})`, detail: "Both came from the same source, the recruiter's message, so this is consistency, not proof. ORYQEN could not show that the employer controls either.", observedAt: observed }));
      else if (site) evidence.push(item({ id: "email-site-mismatch", area: "email", source: "user_supplied", effect: "contradicts", materialWhenConfirmed: true, title: `The address domain ${mailDomain} differs from the website you supplied (${site})`, detail: "Ask which is correct and confirm it through the employer's own official contact details.", observedAt: observed }));
      else evidence.push(item({ id: "email-unverified", area: "email", source: "not_checked", effect: "not_checked", title: `ORYQEN has no verified domain to compare ${mailDomain} with`, detail: "A name or address that looks right is not proof.", observedAt: observed }));
    }
  }

  // 4. The job posting.
  const posting = claim.postingUrl ? normalizeHost(claim.postingUrl) : null;
  if (!claim.postingUrl) evidence.push(item({ id: "posting-none", area: "posting", source: "not_checked", effect: "not_checked", title: "No job advertisement was given to check", detail: "A posting on the employer's own website supports the claim that the role exists.", observedAt: observed }));
  else if (!posting) evidence.push(item({ id: "posting-invalid", area: "posting", source: "user_supplied", effect: "not_checked", title: "The job advertisement address could not be read", detail: "It was not used as evidence.", observedAt: observed }));
  else {
    const lookalikeOf = verifiedDomains.find(domain => lookalike(posting, domain));
    const onEmployer = verifiedDomains.some(domain => belongsTo(posting, domain));
    if (lookalikeOf) evidence.push(item({ id: "posting-lookalike", area: "posting", source: "live_check", effect: "contradicts", material: true, title: `The advertisement is on ${posting}, which looks like the employer's ${lookalikeOf} but is a different domain`, detail: "Look-alike domains are a common way to impersonate a company.", observedAt: observed }));
    else if (hostIn(posting, NO_AUTOMATED_READING)) evidence.push(item({ id: "posting-network", area: "posting", source: "not_checked", effect: "not_checked", title: `The advertisement is on ${posting}; ORYQEN does not read pages there`, detail: "Those services restrict automated access, and a listing there is not proof the employer posted it. Open it yourself and check that the employer's own site lists the same role.", observedAt: observed }));
    else {
      try {
        const page = await withTimeout(deps.fetchText(new URL(claim.postingUrl), { timeoutMs: 6000, maxBytes: 200_000, userAgent: "ORYQEN-Verification/1 (single page read requested by a user)" }), 8000);
        const text = page.text.toLowerCase();
        const role = claim.roleTitle?.toLowerCase(), employerTokens = claim.claimedEmployer.toLowerCase().split(/\s+/).filter(word => word.length > 3).slice(0, 3);
        const mentionsRole = role ? text.includes(role) : null, mentionsEmployer = employerTokens.length ? employerTokens.every(word => text.includes(word)) : null;
        if (page.status !== 200) evidence.push(item({ id: "posting-page", area: "posting", source: "live_check", effect: "neutral", title: `The advertisement page answered with status ${page.status}${page.status >= 300 && page.status < 400 ? " (a redirect, which ORYQEN does not follow)" : ""}`, detail: "The page could not be read, so its content is not used as evidence.", sourceUrl: claim.postingUrl, observedAt: observed }));
        else evidence.push(item({ id: "posting-page", area: "posting", source: "live_check", effect: onEmployer && mentionsRole !== false ? "supports" : "neutral", title: onEmployer ? `The advertisement is on the employer's verified domain${mentionsRole ? " and mentions the role" : ""}` : `The advertisement page is reachable${mentionsRole ? " and mentions the role" : mentionsRole === false ? " but does not mention the role title" : ""}`, detail: `Read once just now.${mentionsEmployer === false ? " The page does not clearly name the employer." : ""} ${onEmployer ? "" : "It is not on a domain the employer proved it controls, so this shows the page exists, not who published it. "}${page.truncated ? "Only the beginning of the page was read." : ""}`.trim(), sourceUrl: claim.postingUrl, observedAt: observed }));
      } catch { evidence.push(item({ id: "posting-page", area: "posting", source: "not_checked", effect: "not_checked", title: "The advertisement page could not be read", detail: "It may block automated reading, be unreachable, or not be a public https page.", sourceUrl: claim.postingUrl, observedAt: observed })); }
    }
    if (hostIn(posting, JOB_BOARDS) && !onEmployer && !hostIn(posting, NO_AUTOMATED_READING)) evidence.push(item({ id: "posting-board", area: "posting", source: "live_check", effect: "neutral", title: `The advertisement is on a third-party job board (${posting})`, detail: "Job boards do not confirm that the person who posted a listing works for the employer.", observedAt: observed }));
  }

  // 5. The professional profile: a person's claim about themselves, never proof, and never read automatically.
  if (claim.profileUrl) evidence.push(item({ id: "profile", area: "profile", source: "user_supplied", effect: "not_checked", title: "A professional profile link was supplied; ORYQEN does not read profiles", detail: "Profiles are written by the person they describe, automated reading is restricted by those services, and a matching name is not proof of identity or of affiliation. Use the link yourself to look for a connection to the employer, then ask the employer to confirm.", sourceUrl: null, observedAt: observed }));
  return { evidence, verifiedDomains };
}

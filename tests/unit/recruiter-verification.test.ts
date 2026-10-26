import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { belongsTo, claimableDomain, emailDomain, hostIn, lookalike, normalizeHost, NO_AUTOMATED_READING } from "@/features/recruiter/domain";
import { evaluateRecruiter } from "@/features/recruiter/status";
import { buildEvidence, domainControl, type EvidenceDeps } from "@/server/recruiter/evidence";
import { verificationResult } from "@/server/recruiter/service";
import type { Evidence, RecruiterResult } from "@/features/recruiter/schema";

const NOW = new Date("2026-10-28T10:00:00Z");
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TOKEN = "a".repeat(40);

describe("domain helpers", () => {
  it("normalizes hosts and reads the domain of an email address", () => {
    expect(normalizeHost("https://WWW.Acme.COM/jobs?x=1")).toBe("www.acme.com"); expect(normalizeHost("acme.com.")).toBe("acme.com");
    for (const bad of ["localhost", "http://10.0.0.1/x", "not a host", "https://[::1]/"]) expect(normalizeHost(bad), bad).toBeNull();
    expect(emailDomain("Jane@Careers.Acme.com")).toBe("careers.acme.com"); expect(emailDomain("no-at-sign")).toBeNull(); expect(emailDomain(null)).toBeNull();
  });
  it("matches subdomains but never look-alike suffixes, and spots confusable names", () => {
    expect(belongsTo("careers.acme.com", "acme.com")).toBe(true); expect(belongsTo("acme.com", "acme.com")).toBe(true); expect(belongsTo("notacme.com", "acme.com")).toBe(false); expect(belongsTo("acme.com.evil.test", "acme.com")).toBe(false);
    expect(lookalike("acrne.com", "acme.com")).toBe(true); expect(lookalike("acmee.com", "acme.com")).toBe(true); expect(lookalike("acme.com", "acme.com")).toBe(false); expect(lookalike("careers.acme.com", "acme.com")).toBe(false); expect(lookalike("zebra.com", "acme.com")).toBe(false); expect(lookalike("ab.com", "ac.com")).toBe(false); // too short to judge
    expect(lookalike("acmetools.net", "acmetools.com")).toBe(true); // same name under another top-level domain
  });
  it("accepts only well-formed employer domains that are not free mail services", () => {
    expect(claimableDomain("acmetools.com")).toBe("acmetools.com"); expect(claimableDomain("  AcmeTools.COM ")).toBe("acmetools.com");
    for (const bad of ["gmail.com", "mail.gmail.com", "no-dot", "http://acmetools.com", "acme..example", "-acmetools.com", "a b.example.test", "192.168.0.1"]) expect(claimableDomain(bad), bad).toBeNull();
    expect(hostIn("www.linkedin.com", NO_AUTOMATED_READING)).toBe(true); expect(hostIn("mylinkedin.com", NO_AUTOMATED_READING)).toBe(false);
  });
});

const supporting = (over: Partial<Evidence> = {}): Evidence => ({ id: "s", area: "email", source: "live_check", effect: "supports", material: false, materialWhenConfirmed: false, title: "supports", detail: "d", sourceLabel: null, sourceUrl: null, observedAt: null, quote: null, ...over });
const claimFor = (companyId: string | null = id(1)) => ({ recruiterName: "R", claimedEmployer: "Acme", companyId, email: "r@acmetools.com" });

describe("status rules", () => {
  const evaluate = (employer: { confirmations: number; disputes: number }, evidence: Evidence[], companyId: string | null = id(1)) => evaluateRecruiter({ claim: claimFor(companyId), employer, evidence });
  it("is VERIFIED only through an employer's current confirmation with nothing material against it", () => {
    expect(evaluate({ confirmations: 1, disputes: 0 }, []).status).toBe("VERIFIED");
    expect(evaluate({ confirmations: 2, disputes: 0 }, [supporting()]).status).toBe("VERIFIED");
    expect(evaluate({ confirmations: 0, disputes: 0 }, [supporting(), supporting({ id: "t" })]).status).toBe("PARTIALLY_VERIFIED"); // no amount of supporting detail replaces the employer
  });
  it("is CONFLICTING_EVIDENCE for a dispute, a look-alike, or a mismatch once the employer has confirmed", () => {
    expect(evaluate({ confirmations: 0, disputes: 1 }, []).status).toBe("CONFLICTING_EVIDENCE");
    expect(evaluate({ confirmations: 1, disputes: 1 }, []).status).toBe("CONFLICTING_EVIDENCE");
    expect(evaluate({ confirmations: 0, disputes: 0 }, [supporting({ effect: "contradicts", material: true, title: "look-alike" })]).status).toBe("CONFLICTING_EVIDENCE");
    const mismatch = supporting({ effect: "contradicts", materialWhenConfirmed: true, title: "mismatch" });
    expect(evaluate({ confirmations: 0, disputes: 0 }, [mismatch, supporting()]).status).toBe("PARTIALLY_VERIFIED"); // an agency may use another domain
    expect(evaluate({ confirmations: 1, disputes: 0 }, [mismatch]).status).toBe("CONFLICTING_EVIDENCE"); // but an employer-confirmed person on a foreign address needs review
  });
  it("is UNVERIFIED with nothing to go on, never counts neutral or user-supplied evidence, and always says what is unresolved", () => {
    const none = evaluate({ confirmations: 0, disputes: 0 }, [supporting({ effect: "neutral" }), supporting({ effect: "not_checked", source: "not_checked", title: "Nothing to compare" })]);
    expect(none.status).toBe("UNVERIFIED"); expect(none.unresolved.join(" ")).toMatch(/not confirmed or disputed|Nothing to compare|No independent evidence/);
    expect(evaluate({ confirmations: 0, disputes: 0 }, [], null).unresolved.join(" ")).toMatch(/not an ORYQEN organization/);
  });
  it("never uses accusing language", () => {
    const all = JSON.stringify([evaluate({ confirmations: 0, disputes: 1 }, [supporting({ effect: "contradicts", material: true })]), evaluate({ confirmations: 0, disputes: 0 }, [])]);
    expect(all).not.toMatch(/scam|scammer|fraud|criminal|liar|dishonest|fake/i);
  });
});

function fakeDeps(over: Partial<EvidenceDeps> & { txt?: Record<string, string[][]>; files?: Record<string, { status: number; text: string }> } = {}): EvidenceDeps {
  return {
    now: () => NOW,
    resolveTxt: over.resolveTxt ?? (async name => { const found = over.txt?.[name]; if (!found) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }); return found; }),
    fetchText: over.fetchText ?? (async url => { const found = over.files?.[url.toString()]; if (!found) throw new Error("unreachable"); return { status: found.status, contentType: "text/plain", location: null, text: found.text, truncated: false }; }),
    registryRecord: over.registryRecord ?? (async () => null),
  };
}
const claim = (over: Partial<RecruiterResult["claim"]> = {}): RecruiterResult["claim"] => ({
  verificationId: id(9), companyId: id(1), recruiterName: "Synthetic Recruiter", claimedEmployer: "Acme Engineering", roleTitle: "Hiring coordinator", email: "r@acmetools.com", profileUrl: "https://www.linkedin.com/in/synthetic", employerSite: "https://acmetools.com",
  postingUrl: "https://acmetools.com/jobs/1", registryLei: null, createdAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 90 * 86400000).toISOString(),
  employer: { confirmations: 0, disputes: 0 }, decisions: [], ...over,
});
const domain = { domainId: id(5), domain: "acmetools.com", token: TOKEN, createdAt: NOW.toISOString() };
const ids = (items: Evidence[]) => items.map(item => `${item.id}:${item.effect}`);

describe("domain control", () => {
  it("accepts the token in DNS or in the well-known file, and nothing else", async () => {
    expect((await domainControl("acmetools.com", TOKEN, fakeDeps({ txt: { "_oryqen-verification.acmetools.com": [[`oryqen-verification=${TOKEN}`]] } }))).method).toBe("dns");
    expect((await domainControl("acmetools.com", TOKEN, fakeDeps({ txt: { "_oryqen-verification.acmetools.com": [["oryqen-verification=", TOKEN]] } }))).method).toBe("dns"); // split TXT strings join
    expect((await domainControl("acmetools.com", TOKEN, fakeDeps({ files: { "https://acmetools.com/.well-known/oryqen-verification.txt": { status: 200, text: `${TOKEN}\n` } } }))).method).toBe("well-known");
    for (const deps of [fakeDeps(), fakeDeps({ txt: { "_oryqen-verification.acmetools.com": [["oryqen-verification=" + "b".repeat(40)]] } }), fakeDeps({ files: { "https://acmetools.com/.well-known/oryqen-verification.txt": { status: 200, text: "something else" } } }), fakeDeps({ files: { "https://acmetools.com/.well-known/oryqen-verification.txt": { status: 404, text: TOKEN } } })])
      expect((await domainControl("acmetools.com", TOKEN, deps)).controlled).toBe(false);
  });
});

describe("evidence", () => {
  const proven = { txt: { "_oryqen-verification.acmetools.com": [[`oryqen-verification=${TOKEN}`]] } };
  it("supports an address on a proven domain and a posting on it, without treating either as proof of the person", async () => {
    const page = { "https://acmetools.com/jobs/1": { status: 200, text: "<h1>Hiring coordinator</h1> Acme Engineering is hiring" } };
    const { evidence, verifiedDomains } = await buildEvidence(claim(), [domain], fakeDeps({ ...proven, files: page }));
    expect(verifiedDomains).toEqual(["acmetools.com"]);
    expect(ids(evidence)).toEqual(expect.arrayContaining(["domain-" + id(5).slice(0, 8) + ":supports", "email-match:supports", "posting-page:supports", "profile:not_checked"]));
    expect(evidence.find(item => item.id === "email-match")!.detail).toMatch(/does not show the person using it was authorized/);
    expect(evidence.every(item => item.observedAt === NOW.toISOString() || item.observedAt === null)).toBe(true);
  });
  it("flags a look-alike address or posting as material, and a different address as a mismatch that matters only after an employer confirms", async () => {
    const lookalikeMail = (await buildEvidence(claim({ email: "r@acrnetools.com" }), [domain], fakeDeps(proven))).evidence.find(item => item.area === "email")!;
    expect(lookalikeMail).toMatchObject({ id: "email-lookalike", effect: "contradicts", material: true });
    const mismatch = (await buildEvidence(claim({ email: "r@staffing-agency.org" }), [domain], fakeDeps(proven))).evidence.find(item => item.area === "email")!;
    expect(mismatch).toMatchObject({ id: "email-mismatch", effect: "contradicts", material: false, materialWhenConfirmed: true });
    const post = (await buildEvidence(claim({ postingUrl: "https://acrnetools.com/jobs/1" }), [domain], fakeDeps(proven))).evidence.find(item => item.area === "posting")!;
    expect(post).toMatchObject({ id: "posting-lookalike", material: true });
  });
  it("treats free mail as neutral, never as support, and never reads professional networks or profiles", async () => {
    const fetchText = vi.fn(async () => { throw new Error("must not be called"); });
    const free = (await buildEvidence(claim({ email: "recruiter@gmail.com", postingUrl: "https://www.linkedin.com/jobs/view/1", employerSite: null }), [], fakeDeps({ fetchText }))).evidence;
    expect(free.find(item => item.area === "email")).toMatchObject({ id: "email-free", effect: "neutral" });
    expect(free.find(item => item.area === "posting")).toMatchObject({ id: "posting-network", effect: "not_checked" });
    expect(free.find(item => item.area === "profile")).toMatchObject({ effect: "not_checked", source: "user_supplied" });
    expect(fetchText).not.toHaveBeenCalled();
    expect(free.some(item => item.effect === "supports")).toBe(false);
  });
  it("without a verified domain compares only with what the person supplied and says it is not proof", async () => {
    const same = (await buildEvidence(claim(), [], fakeDeps())).evidence.find(item => item.area === "email")!;
    expect(same).toMatchObject({ id: "email-site", effect: "neutral", source: "user_supplied" });
    const other = (await buildEvidence(claim({ email: "r@somewhere-else.org" }), [], fakeDeps())).evidence.find(item => item.area === "email")!;
    expect(other).toMatchObject({ id: "email-site-mismatch", effect: "contradicts", materialWhenConfirmed: true });
    expect((await buildEvidence(claim({ employerSite: null }), [], fakeDeps())).evidence.find(item => item.area === "email")).toMatchObject({ id: "email-unverified", effect: "not_checked" });
  });
  it("isolates failures: an unreadable page, an unreachable registry and a failing DNS lookup each become not checked", async () => {
    const deps = fakeDeps({ resolveTxt: async () => { throw new Error("dns down"); }, registryRecord: async () => { throw new Error("registry down"); } });
    const { evidence } = await buildEvidence(claim({ registryLei: "A".repeat(20) }), [domain], deps);
    expect(evidence.find(item => item.id === "registry")).toMatchObject({ effect: "not_checked" });
    expect(evidence.find(item => item.id === "posting-page")).toMatchObject({ effect: "not_checked" });
    expect(evidence.find(item => item.id.startsWith("domain-"))).toMatchObject({ effect: "neutral" });
    expect(evidence.some(item => item.effect === "supports")).toBe(false);
  });
  it("uses a linked registry record only as support that an entity of that name exists", async () => {
    const record = { legalName: "Acme Engineering Ltd", otherNames: [], country: "LK", sourceUrl: "https://api.gleif.org/api/v1/lei-records/X", entityStatus: "ACTIVE" };
    const good = (await buildEvidence(claim({ registryLei: "A".repeat(20) }), [], fakeDeps({ registryRecord: async () => record }))).evidence.find(item => item.id === "registry")!;
    expect(good).toMatchObject({ effect: "supports", source: "registry" }); expect(good.detail).toMatch(/does not show who that entity employs or authorized/);
    const bad = (await buildEvidence(claim({ registryLei: "A".repeat(20), claimedEmployer: "Totally Different Holdings" }), [], fakeDeps({ registryRecord: async () => record }))).evidence.find(item => item.id === "registry")!;
    expect(bad.effect).toBe("neutral");
  });
});

describe("full result", () => {
  const read = (employer: RecruiterResult["claim"]["employer"], decisions: RecruiterResult["claim"]["decisions"] = []) => vi.fn(async (name: string) => {
    if (name === "recruiter_read") return { data: claim({ employer, decisions }), error: null };
    if (name === "company_domain_list") return { data: { items: [domain] }, error: null };
    return { data: null, error: { message: "NOT_FOUND" } };
  });
  const deps = fakeDeps({ txt: { "_oryqen-verification.acmetools.com": [[`oryqen-verification=${TOKEN}`]] }, files: { "https://acmetools.com/jobs/1": { status: 200, text: "Hiring coordinator at Acme Engineering" } } });

  it("is verified when a representative confirms, with the employer's own reason quoted and dated evidence", async () => {
    const result = await verificationResult(read({ confirmations: 1, disputes: 0, confirmedUntil: "2027-01-01T00:00:00Z" }, [{ decision: "confirm", reason: "She is on our recruiting team", validUntil: "2027-01-01T00:00:00Z", at: NOW.toISOString() }]), id(9), deps);
    expect(result.status).toBe("VERIFIED"); expect(result.claim.verificationId).toBe(id(9));
    expect(result.evidence.find(item => item.id === "decision-confirm")).toMatchObject({ source: "employer_confirmation", effect: "supports" });
    expect(result.evidence.find(item => item.id === "decision-confirm")!.detail).toMatch(/did not verify the person's identity/);
    expect(result.limits.join(" ")).toMatch(/Never send money/);
  });
  it("is partially verified from domain and posting evidence alone, and conflicting after a dispute", async () => {
    expect((await verificationResult(read({ confirmations: 0, disputes: 0 }), id(9), deps)).status).toBe("PARTIALLY_VERIFIED");
    const disputed = await verificationResult(read({ confirmations: 0, disputes: 1 }, [{ decision: "dispute", reason: "Not one of our staff", validUntil: null, at: NOW.toISOString() }]), id(9), deps);
    expect(disputed.status).toBe("CONFLICTING_EVIDENCE"); expect(disputed.evidence.find(item => item.id === "decision-dispute")!.detail).toContain("Not one of our staff");
  });
  it("is unverified when the employer is not on ORYQEN and nothing could be read, and maps a missing claim to NOT_FOUND", async () => {
    const rpc = vi.fn(async (name: string) => name === "recruiter_read" ? { data: claim({ companyId: null, email: null, postingUrl: null, employerSite: null, profileUrl: null }), error: null } : { data: null, error: { message: "NOT_FOUND" } });
    const result = await verificationResult(rpc, id(9), fakeDeps());
    expect(result.status).toBe("UNVERIFIED"); expect(rpc).not.toHaveBeenCalledWith("company_domain_list", expect.anything());
    await expect(verificationResult(async () => ({ data: null, error: { message: "NOT_FOUND", code: "P0001" } }), id(9), fakeDeps())).rejects.toMatchObject({ status: 404 });
    await expect(verificationResult(async () => ({ data: { unexpected: true }, error: null }), id(9), fakeDeps())).rejects.toMatchObject({ status: 503 });
  });
});

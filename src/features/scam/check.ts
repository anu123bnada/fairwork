// Recruiter scam indicators (module 17). Each indicator quotes the exact text it matched and explains why it
// deserves a second look. These are wording and domain checks, not a verdict: nothing here says a recruiter or
// company is fraudulent, and a clean result does not say it is safe. Deterministic and local; no network access.

export type ScamIndicator = {
  id: string; severity: "high" | "medium"; title: string; description: string; quote: string; recommendation: string;
};

const FREE_MAIL = /\b[a-z0-9._%+-]+@(?:gmail|googlemail|yahoo|ymail|outlook|hotmail|live|aol|proton|protonmail|icloud|gmx|mail)\.[a-z.]{2,}\b/i;
const EMAIL = /\b[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi;

const rules: { id: string; severity: "high" | "medium"; pattern: RegExp; title: string; description: string; recommendation: string }[] = [
  {
    id: "scam-gift-card-crypto", severity: "high",
    pattern: /\b(?:gift\s*cards?|itunes\s*cards?|google\s*play\s*cards?|bitcoin|crypto(?:currency)?|usdt|western\s*union|moneygram|wire\s*transfer\s*(?:to|of)\s+(?:a\s+)?(?:personal|private))\b/i,
    title: "Unusual payment method mentioned",
    description: "Gift cards, cryptocurrency or money-transfer services are a common way to collect money from job seekers. Genuine employers normally pay wages into a bank account and do not ask applicants to pay this way.",
    recommendation: "Do not send money or card codes. Ask for the payment purpose in writing and check the company through an independent channel.",
  },
  {
    id: "scam-pay-to-start", severity: "high",
    pattern: /\b(?:pay|send|transfer|deposit)\b[^.\n]{0,40}?(?:\d|\bfees?\b|\bmoney\b|\bpayment\b|\bdeposit\b)[^.\n]{0,40}?\b(?:to\s+(?:secure|reserve|confirm|start|process|release)|before\s+(?:you\s+)?(?:start|begin|joining|the\s+contract|receiving))\b/i,
    title: "Payment requested before work or a contract",
    description: "Wording asks for money before the job starts or before a contract is issued.",
    recommendation: "Ask who receives the money, why, and whether it is refundable, in writing, before paying anything.",
  },
  {
    id: "scam-guaranteed-abroad", severity: "high",
    pattern: /\b(?:guaranteed|100%\s*(?:sure|guaranteed)|assured)\s+(?:job|visa|placement|work\s*permit|employment)\b/i,
    title: "Guaranteed job or visa claim",
    description: "No agent can lawfully guarantee a job abroad, a visa or a work permit. Guarantees combined with fees are a recognised warning sign.",
    recommendation: "Check the agency's licence with your government's foreign-employment regulator and the employer directly.",
  },
  {
    id: "scam-off-platform-chat", severity: "medium",
    pattern: /\b(?:contact|message|text|chat|reach)\b[^.\n]{0,40}\b(?:only\s+(?:on|via|through)\s+)?(?:whatsapp|telegram|signal|wechat|viber)\b|\b(?:interview|hiring)\b[^.\n]{0,40}\b(?:on|via|through)\s+(?:whatsapp|telegram|signal|wechat|viber)\b/i,
    title: "Hiring conducted only through a chat app",
    description: "The offer moves the conversation to a private chat app. Real recruiters often use these apps too, so this alone proves nothing, but it removes records and company checks.",
    recommendation: "Ask for an email from the company's own domain and a contract before sharing documents.",
  },
  {
    id: "scam-sensitive-data-early", severity: "high",
    pattern: /\b(?:send|share|provide|submit)\b[^.\n]{0,50}\b(?:bank\s*(?:pin|password|login)|otp|one[-\s]*time\s*(?:code|password)|card\s*(?:pin|cvv)|passport\s*(?:copy|scan)\s*(?:and|&)\s*bank)\b/i,
    title: "Sensitive credentials or codes requested",
    description: "Bank logins, PINs and one-time codes are never needed to hire someone.",
    recommendation: "Do not share them with anyone. Contact your bank if you already did.",
  },
  {
    id: "scam-urgency", severity: "medium",
    pattern: /\b(?:reply|respond|confirm|accept|pay)\b[^.\n]{0,30}\b(?:within\s+(?:\d{1,2}\s*hours?|24\s*hours?|the\s+hour)|immediately|today\s+only|right\s+now)\b|\blimited\s+(?:slots|vacancies|positions)\b[^.\n]{0,40}\b(?:today|immediately|now)\b/i,
    title: "Pressure to act immediately",
    description: "A very short deadline leaves no time to check the employer.",
    recommendation: "Take the time to verify the company; genuine offers can wait a reasonable period.",
  },
  {
    id: "scam-unrealistic-pay", severity: "medium",
    pattern: /\b(?:earn|make)\s+(?:up\s+to\s+)?(?:[$€£]|usd|eur|gbp|lkr|rs\.?)\s*\d[\d,]*\s*(?:per|a|\/)\s*(?:day|week)\b[^.\n]{0,60}\b(?:no\s+(?:experience|skills?|qualifications?)|from\s+home|part[-\s]*time)\b/i,
    title: "Very high pay for no experience",
    description: "High daily or weekly pay for no experience or qualifications is a common lure.",
    recommendation: "Compare with the usual pay for the role and ask exactly what work is done and who pays.",
  },
];

function domainOf(value: string) {
  return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/:?#].*$/, "").replace(/\.$/, "");
}
function registrable(domain: string) {
  const parts = domain.split(".");
  const secondLevel = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
  return parts.length >= 3 && secondLevel.has(parts[parts.length - 2]!) && parts[parts.length - 1]!.length === 2 ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
}
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!; row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const held = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = held;
    }
  }
  return row[b.length]!;
}
// Visual look-alikes such as rn for m, 0 for o, 1 for l, and vv for w.
const fold = (value: string) => value.replace(/rn/g, "m").replace(/vv/g, "w").replace(/0/g, "o").replace(/[1|]/g, "l");

export function scamIndicators(text: string, options: { companyDomain?: string } = {}): ScamIndicator[] {
  const found: ScamIndicator[] = [];
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (match) found.push({ id: rule.id, severity: rule.severity, title: rule.title, description: rule.description, quote: match[0].replace(/\s+/g, " ").slice(0, 160), recommendation: rule.recommendation });
  }
  const emails = [...text.matchAll(EMAIL)].map(match => ({ address: match[0], domain: match[1]!.toLowerCase() }));
  const free = text.match(FREE_MAIL);
  if (free && /\b(?:company|corporation|ltd|limited|plc|gmbh|inc|hr\s*(?:department|team|manager)|recruit(?:er|ment))\b/i.test(text)) {
    found.push({
      id: "scam-free-mail-company", severity: "medium", title: "A company role using a free email address",
      description: "The contact is on a free email service although the message speaks for a company. Small employers and individual recruiters do this legitimately, so it is a prompt to verify, not a finding.",
      quote: free[0], recommendation: "Ask for an address on the company's own domain, then confirm the company independently.",
    });
  }
  const claimed = options.companyDomain ? registrable(domainOf(options.companyDomain)) : null;
  if (claimed) {
    for (const email of emails) {
      const actual = registrable(email.domain);
      if (actual === claimed || FREE_MAIL.test(email.address)) continue;
      const near = distance(fold(actual.split(".")[0]!), fold(claimed.split(".")[0]!)) <= 1 && actual !== claimed;
      found.push(near
        ? { id: "scam-lookalike-domain", severity: "high", title: "Email domain looks like the company's but is different", description: `The address uses ${actual}, which is very close to the company's ${claimed} but not the same. Look-alike domains are used to impersonate companies.`, quote: email.address, recommendation: "Do not reply or share documents. Find the company's official contact details yourself and ask whether this person works there." }
        : { id: "scam-domain-mismatch", severity: "medium", title: "Email domain does not match the company", description: `The address uses ${actual}, but the company's website is ${claimed}. Recruitment agencies and group companies legitimately use other domains.`, quote: email.address, recommendation: "Ask the recruiter how they are connected to the company and confirm with the company directly." });
    }
  }
  return found;
}

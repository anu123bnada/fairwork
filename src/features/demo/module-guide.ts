// The 22 modules and how a visitor can actually see each one. "real" needs an account (the screen is the real product); "try" runs here with no account and no data leaving the device;
// "needs-accounts" is real but cannot be completed by one visitor because it needs an independent counterpart (employer, reviewer, operator). Nothing here claims verification.
export type GuideMode = "real" | "try" | "needs-accounts" | "protected";
export type GuideEntry = { n: number; module: string; mode: GuideMode; where: string; href: string; note: string };

export const moduleGuide: readonly GuideEntry[] = [
  { n: 1, module: "AI Employment Intelligence", mode: "real", where: "Add a job offer (sample offer button)", href: "/app/add-offer", note: "Rule-based analysis with explained findings. The AI model is OFF on this build, so no AI result is ever shown." },
  { n: 2, module: "Employer & Company Intelligence", mode: "try", where: "Sample employers (Worker tab)", href: "/try?tab=worker&demo=employers", note: "Invented companies; sample, user-submitted and verified information are kept apart and nothing is verified." },
  { n: 3, module: "Career Intelligence & Matching", mode: "try", where: "Career explorer (Worker tab)", href: "/try?tab=worker&demo=career", note: "A SAMPLE framework of invented roles. Sign in to save roadmaps and import CV skills." },
  { n: 4, module: "Employment Offer Workspace", mode: "real", where: "Add a job offer, saved offers", href: "/app/add-offer", note: "Saved offers with revisions, notes and comparison." },
  { n: 5, module: "Digital Employment Agreements", mode: "needs-accounts", where: "Agreement workflow", href: "/app/agreement-workflow", note: "Needs an employer and a worker account. No electronic signature is offered and none is claimed." },
  { n: 6, module: "Evidence Vault & Work Records", mode: "real", where: "Work records", href: "/app/work-record", note: "Private uploads with checksums and signed downloads." },
  { n: 7, module: "Work Passport", mode: "real", where: "Work Passport", href: "/app/passport", note: "Shows verified work only; an employer must verify a record first." },
  { n: 8, module: "Employer & Organization Portal", mode: "try", where: "Organization sandbox (Employer tab)", href: "/try?tab=employer&demo=org", note: "Fictional applicants on this device. The real review screen needs an approved organization representative." },
  { n: 9, module: "Disputes & Appeals", mode: "needs-accounts", where: "Cases", href: "/app/cases", note: "Needs an independent reviewer account." },
  { n: 10, module: "Tamper-Evident Trust Ledger", mode: "real", where: "Work Passport (Trust chain)", href: "/app/passport", note: "Hash-chained history with detected tampering. It is not a blockchain." },
  { n: 11, module: "ORYQEN AI Copilot", mode: "try", where: "Career assistant (Worker tab)", href: "/try?tab=worker&demo=assistant", note: "DEMO: fixed rules, no AI model, no access to any account data." },
  { n: 12, module: "Security & Privacy", mode: "real", where: "Settings", href: "/app/settings", note: "Multi-factor sign-in, activity log, data export and privacy requests." },
  { n: 13, module: "Administration & Governance", mode: "protected", where: "Admin console", href: "/admin", note: "Protected: it needs an authorized operator with multi-factor sign-in and is never publicly accessible." },
  { n: 14, module: "Premium Multiplatform Experience", mode: "real", where: "Downloads", href: "/downloads", note: "Responsive web today. Android and Windows builds are listed only once an official link exists." },
  { n: 15, module: "Global Localization", mode: "real", where: "Settings (language)", href: "/app/settings", note: "English, Sinhala, Tamil and German; screens added recently are English only." },
  { n: 16, module: "Country-Aware Employment Intelligence", mode: "real", where: "Add a job offer (Germany rules)", href: "/app/add-offer", note: "Germany rules with sources. Other countries are not available and say so." },
  { n: 17, module: "Recruiter Scam Intelligence", mode: "try", where: "Recruiter message check (Recruiter tab)", href: "/try?tab=recruiter&demo=check", note: "Rule-based indicators that quote the matched text. A clean result does not mean safe." },
  { n: 18, module: "Verifiable Credentials & QR", mode: "real", where: "Verify a credential", href: "/verify", note: "Public status check; it shows no personal data." },
  { n: 19, module: "Salary Intelligence & Benchmarking", mode: "try", where: "Salary comparison (Worker tab)", href: "/try?tab=worker&demo=salary", note: "Compares an offer with reference points you add yourself. ORYQEN holds no market salary data." },
  { n: 20, module: "Notifications & Employment Timeline", mode: "real", where: "Notifications", href: "/app/notifications", note: "Feed with read state, plus reminders from your own application tracker." },
  { n: 21, module: "Developer API & Integrations", mode: "real", where: "Settings (Developer access)", href: "/app/settings", note: "API keys are shown once and can be revoked." },
  { n: 22, module: "Entitlements & Business Infrastructure", mode: "real", where: "Settings (Plan)", href: "/app/settings", note: "Free plan; no billing is offered and no payment is ever claimed." },
];
export const modeLabel: Record<GuideMode, string> = { real: "Real (sign in)", try: "Try it here, no account", "needs-accounts": "Real, needs a counterpart account", protected: "Protected" };

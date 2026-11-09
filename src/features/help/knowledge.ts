// ORYQEN Help assistant: a fixed, written guide plus a plain keyword matcher. It is NOT AI: it never calls a model or any service, never stores the question, and cannot
// see anyone's records. Every answer below is written by hand and must stay true of the product as it is built today. Features that do not exist are described as
// "not available yet", never as available. Text is English only.
export type HelpLink = { label: string; href: string };
export type HelpEntry = { id: string; title: string; keywords: string[]; answer: string; links: HelpLink[] };

export const helpLinkTargets = ["/app/home", "/app/add-offer", "/app/scan", "/app/check", "/app/agreement-workflow", "/app/work-record", "/app/passport", "/app/share", "/app/cv", "/app/opportunities", "/app/applications", "/app/cover-letter", "/app/career-explorer", "/app/portfolio", "/app/applicants", "/app/workroom", "/app/guidance", "/app/settings", "/app/notifications", "/app/cases", "/verify", "/about"] as const;
const link = (label: string, href: (typeof helpLinkTargets)[number]): HelpLink => ({ label, href });

export const helpEntries: HelpEntry[] = [
  { id: "what-is-oryqen", title: "What is ORYQEN?", keywords: ["what is oryqen", "about oryqen", "what does oryqen do", "oryqen", "purpose"],
    answer: "ORYQEN helps you understand job offers, keep a private record of your work, and share verified proof of it only with people you choose. Everything you type is private to you unless you share it. Some parts are still being built; ask about \"not available\" to see which.",
    links: [link("About ORYQEN", "/about"), link("Home", "/app/home")] },
  { id: "add-offer", title: "How do I add a job offer?", keywords: ["add offer", "add a job offer", "paste offer", "new offer", "enter offer", "job offer", "offer text", "upload offer", "pdf offer", "word document"],
    answer: "Open Add offer, then choose how to add it: paste the text, read a screenshot, a PDF or a Word document on your device, or enter the details by hand. Then press \"Suggest terms with local rules\" and check every field yourself before you analyze. Reading an image is imperfect, so pasted text or a clear PDF works best.",
    links: [link("Add offer", "/app/add-offer")] },
  { id: "scan-offer", title: "How do I scan a screenshot of an offer?", keywords: ["scan", "scan offer", "scan screenshot", "screenshot", "screenshot of offer", "scanning", "read image", "photo of offer", "image of offer", "report", "scan report"],
    answer: "Open Scan an offer and choose a PNG or JPEG screenshot. A scanning window shows each real step as it happens: checking the image, reading the text on your device, checking readability, and checking terms and warning signs with rules. You then get a report with a summary, findings that quote the exact words, the text that was read (which you can correct), and next steps. The image never leaves your device. Real AI analysis is optional and only works once the site owner has switched it on and you consent.",
    links: [link("Scan an offer", "/app/scan"), link("Add offer", "/app/add-offer")] },
  { id: "analyze-offer", title: "How is my offer checked?", keywords: ["analyze offer", "analyse offer", "check offer", "offer checked", "findings", "warning signs", "missing terms", "unclear terms", "questions to ask", "red flags", "scam offer"],
    answer: "ORYQEN reads your offer with fixed rules and lists what is clear, what is missing (for example pay period, hours or notice) and warning signs, each with the exact words it relied on. It also suggests questions to ask the employer. This is guidance, not legal advice, and it does not decide for you.",
    links: [link("ORYQEN Check", "/app/check"), link("Add offer", "/app/add-offer")] },
  { id: "ai-status", title: "Why is AI analysis not working?", keywords: ["ai not working", "ai analysis", "ai analyze", "ai analyse", "ai agent", "artificial intelligence", "gemini", "ai suggestions", "live ai", "ai unavailable", "ai off", "ai"],
    answer: "AI analysis is switched off on purpose until the site owner configures an AI provider and approves, in writing, how offer text may be processed. Until then ORYQEN says so and shows rules-based checks instead. Nothing is invented and no text is sent to any AI service. The \"Suggest terms with local rules\" button works now and is not AI.",
    links: [link("Add offer", "/app/add-offer")] },
  { id: "this-assistant", title: "Is this assistant AI?", keywords: ["is this ai", "are you ai", "are you a bot", "chatbot", "chat bot", "who are you", "assistant", "help bot", "robot"],
    answer: "No. This is a help assistant that answers from a written guide using simple keyword matching. It does not use AI, cannot see your offers, records or account, and does not keep your questions. If your question is not covered it says so. Private guidance (also rules-based) can talk about your own offers.",
    links: [link("Private guidance", "/app/guidance")] },
  { id: "cv-builder", title: "How do I make a CV?", keywords: ["cv", "resume", "curriculum vitae", "make a cv", "build cv", "cv builder", "cv template", "download cv", "pdf cv"],
    answer: "Open CV Builder and press New CV. Fill in your details, pick a layout (Classic, Modern or Compact), and watch the preview update. Save it, keep several versions (for example one per role), and use \"Print or save as PDF\". Everything you type is self-reported; your verified work from the Work Passport can be included and is labelled as verified. No AI writes your CV.",
    links: [link("CV Builder", "/app/cv"), link("Work Passport", "/app/passport")] },
  { id: "cv-analyzer", title: "How do I check or improve my CV?", keywords: ["analyze cv", "analyse cv", "cv analyzer", "cv analyser", "check my cv", "improve my cv", "cv score", "ats", "ats checker", "applicant tracking", "skill gap", "skills gap", "job description", "keywords", "cv feedback", "matching jobs", "jobs for my skills"],
    answer: "Open CV Builder, then the section \"Analyze this CV (rules-based, not AI)\". It scores the CV you are editing out of 100 with every point explained, lists what to fix, gives applicant-tracking-system (ATS) notes, and can compare your CV with a job description you paste, showing which of the job's terms your CV does and does not mention. It also lists published listings that mention your skills. It cannot tell whether your claims are true, and you should add a missing term only if it is true for you.",
    links: [link("CV Builder", "/app/cv"), link("Job opportunities", "/app/opportunities")] },
  { id: "applicants", title: "How do I apply, and how do organizations review applicants?", keywords: ["apply", "apply for a job", "applicant", "applicants", "candidate", "candidates", "applications", "shortlist", "review applicants", "hiring", "employer dashboard", "my listings"],
    answer: "On Job opportunities, press Apply on a published listing and write a short message. The organization sees only your display name and that message, nothing from your CV, Passport or documents. You can follow or withdraw it in Application tracker. Organization representatives who published a listing open Applicants to see counts and mark each applicant reviewing, shortlisted or declined. ORYQEN does not verify applicants or message them.",
    links: [link("Job opportunities", "/app/opportunities"), link("Applicants", "/app/applicants"), link("Application tracker", "/app/applications")] },
  { id: "portfolio", title: "How do I build a portfolio?", keywords: ["portfolio", "portfolio builder", "work samples", "certificates", "achievements", "showcase my work", "projects i did"],
    answer: "Open Portfolio and press Add an entry. Choose a type (project, certificate, achievement or work sample), describe it, add skills and an https link if you have one, and save it as a draft or ready. Entries are private to you, typed by you, and not verified by ORYQEN. Only the Work Passport shows employer-verified work.",
    links: [link("Portfolio", "/app/portfolio"), link("Work Passport", "/app/passport")] },
  { id: "career-explorer", title: "How do I explore careers and see my skill gap?", keywords: ["career", "career path", "career explorer", "skill gap", "skills gap", "roadmap", "career roadmap", "what skills do i need", "next role", "career change"],
    answer: "Open Career explorer, tick the skills you have or import them from your CV, and pick a target role. You see how many core skills you already cover, which are missing and a step-by-step roadmap. The roles and skills are a SAMPLE framework written for this demonstration, not real labour-market data, and your skills are self-reported and saved only on this device.",
    links: [link("Career explorer", "/app/career-explorer"), link("CV Builder", "/app/cv")] },
  { id: "cover-letter", title: "Can ORYQEN write a cover letter?", keywords: ["cover letter", "covering letter", "application letter", "write a letter", "letter for job"],
    answer: "Open Cover letter, fill in the job, employer, your strengths and one real example, and a plain letter is assembled from your own words. It is a template, not AI: it adds no facts about you, and nothing is saved or sent. Copy it or print it, and check it before you use it.",
    links: [link("Cover letter", "/app/cover-letter"), link("CV Builder", "/app/cv")] },
  { id: "application-tracker", title: "How do I track the jobs I applied for?", keywords: ["application tracker", "track applications", "applied", "applied jobs", "interview date", "interview tracker", "follow up", "follow-up", "next step", "interview preparation", "interview prep", "job status", "saved jobs", "rejected", "offered"],
    answer: "Open Application tracker and press Add an application. You can fill it yourself or pick a published listing. Set the stage (saved, applied, interviewing, offered, accepted, rejected, withdrawn), add a next step date, interviews and follow-ups, and tick the preparation checklist. It is your own private record: ORYQEN does not contact employers and does not verify what you enter.",
    links: [link("Application tracker", "/app/applications"), link("Job opportunities", "/app/opportunities")] },
  { id: "workroom", title: "How do I plan projects and tasks?", keywords: ["workroom", "project", "projects", "tasks", "task list", "milestone", "milestones", "progress", "plan my work", "work record"],
    answer: "Open Workroom and press Add a project. Give it a name, a status and an optional due date, then add milestones and tasks. Progress is counted from the tasks you tick, so it is never invented. Projects are private to you and unverified; only the Work Passport shows employer-verified work.",
    links: [link("Workroom", "/app/workroom"), link("Work Passport", "/app/passport")] },
  { id: "passport", title: "What is the Work Passport?", keywords: ["passport", "verified work", "verified hours", "work profile", "proof of work", "print passport", "download passport"],
    answer: "The Work Passport lists only work that an employer representative verified and that is not withdrawn or disputed. It is private to you until you share it. You can print or save it as a PDF, or download a copy. A printed copy is not a signed certificate and cannot be revoked once printed.",
    links: [link("Work Passport", "/app/passport")] },
  { id: "passport-share", title: "How do I share or stop sharing my Passport?", keywords: ["share", "sharing", "share passport", "share my passport", "share work passport", "revoke", "revoke access", "stop sharing", "recipient", "named recipient", "who can see", "unshare", "qr code", "qr"],
    answer: "Open Share, choose what to share and the named person who may see it, and create the link. A shared link grants nothing without that named account. To stop, revoke the share on the same screen; access ends after the person refreshes.",
    links: [link("Share your Passport", "/app/share"), link("Work Passport", "/app/passport")] },
  { id: "verify-credential", title: "How do I check a credential or QR code?", keywords: ["verify credential", "check credential", "credential", "verify qr", "scan qr", "credential check", "is this valid", "verification page"],
    answer: "Open the public verification page and paste the credential or follow its link. It tells you whether the credential is valid, expired or revoked, and shows no personal data. A valid result only means ORYQEN issued it and it has not been revoked.",
    links: [link("Verify a credential", "/verify")] },
  { id: "evidence", title: "How do I store documents and evidence?", keywords: ["evidence", "vault", "evidence vault", "upload document", "upload file", "pay slip", "payslip", "payslips", "documents", "attach document", "private storage"],
    answer: "Use the Evidence Vault from Work record to upload PDF, PNG, JPEG or WebP files (up to 5 MB, 50 per person). Files are private to you, checked on upload, and downloaded through short-lived links. You can link a document to a work record, mark it revoked or in need of correction, or delete it.",
    links: [link("Work record", "/app/work-record")] },
  { id: "work-record", title: "How do I record my work?", keywords: ["work record", "record work", "log hours", "hours worked", "timesheet", "work history", "add work", "employment history", "verified by employer"],
    answer: "Open Work record to add your work: role, period, hours and tasks. Submit it for your employer representative to review. Only the version they verify can appear in your Work Passport, and you can withdraw or correct a record later while keeping its history.",
    links: [link("Work record", "/app/work-record")] },
  { id: "agreements", title: "How do agreements work?", keywords: ["agreement", "agreements", "contract", "confirm agreement", "acknowledge", "amend", "amendment", "agreement expiry", "terms agreed"],
    answer: "An agreement is proposed from an offer, then each side reviews and confirms it separately; it becomes effective only after both have confirmed. Each version is kept, and a proposal can have an expiry date. ORYQEN records the steps but does not claim that a confirmation is a legally binding signature.",
    links: [link("Agreements", "/app/agreement-workflow")] },
  { id: "disputes", title: "What if something goes wrong with a record?", keywords: ["dispute", "disputes", "appeal", "complaint", "problem with employer", "case", "cases", "unfair", "wrong record", "incorrect pay", "report problem"],
    answer: "You can open a case on a work record, choose a reason (for example incorrect pay or hours), add evidence from your own vault, and follow its timeline. An independent reviewer decides, and you can appeal. The affected Passport entry is hidden while a case is open. This does not replace a labour authority, court or lawyer.",
    links: [link("Case review", "/app/cases")] },
  { id: "opportunities", title: "How do I find opportunities?", keywords: ["opportunities", "opportunity", "jobs", "find a job", "job search", "listings", "saved listing", "compare listings", "match", "preferences", "internship", "apprenticeship"],
    answer: "Open Job opportunities, set your preferences (role, place, work arrangement, minimum pay), then save listings to compare them. ORYQEN explains each match in words: which of your criteria matched, differed or could not be compared. Listings are created by organizations on the platform; ORYQEN does not invent jobs. Your saved-listing history is private.",
    links: [link("Job opportunities", "/app/opportunities")] },
  { id: "company-research", title: "How do I research an employer?", keywords: ["company research", "research company", "research employer", "check company", "is the company real", "company registered", "gleif", "employer legitimate", "recruiter check", "verify employer"],
    answer: "On Home, open \"Research an employer\" to search the public GLEIF registry by name. Results show where each fact came from and when it was retrieved. A match means a registry entry exists, not that the employer is trustworthy, and ORYQEN does not make up ratings or scores.",
    links: [link("Home", "/app/home")] },
  { id: "scam", title: "How do I spot or report a scam?", keywords: ["scam", "fraud", "fake job", "report listing", "report scam", "suspicious", "pay to start", "advance fee", "otp", "visa guarantee", "too good to be true"],
    answer: "Warning signs include being asked to pay to start, guaranteed visas or pay, requests for passwords or one-time codes, hiring only over chat apps, and an email domain that does not match the company. ORYQEN's checks point these out. You can report a suspicious listing or recruiter privately; reviewers do not see who reported it.",
    links: [link("Add offer", "/app/add-offer"), link("Job opportunities", "/app/opportunities")] },
  { id: "organizations", title: "I represent an employer. What can I do?", keywords: ["employer", "organization", "organisation", "company account", "representative", "employer portal", "verify work", "hire", "post a job", "publish listing", "team"],
    answer: "An employer representative requests an organization, which an independent reviewer must approve before it gets any authority. Approved representatives can manage company details, publish listings, create agreements and verify work records. Everything they publish is labelled as organization-provided, not independently verified.",
    links: [link("Employer", "/app/home")] },
  { id: "account-security", title: "How do I secure my account?", keywords: ["security", "password", "forgot password", "reset password", "mfa", "two factor", "2fa", "authenticator", "sign in problem", "login", "security activity", "recent sign ins"],
    answer: "In Settings you can add an authenticator app (a second factor) and see Security activity, your recent sign-ins and sign-outs. If you forgot your password use \"Forgot your password?\" on the sign-in page; a reset link does not bypass your second factor. Never share one-time codes with anyone, including ORYQEN.",
    links: [link("Settings", "/app/settings")] },
  { id: "privacy-data", title: "Is my data private? Can I download or delete it?", keywords: ["privacy", "private", "data", "my data", "download my data", "export data", "delete account", "deactivate", "delete my data", "who sees my data", "gdpr", "data safe"],
    answer: "Your offers, CVs, documents and history are private to you; other people see something only when you share it. In Settings you can download your data, send a privacy request, or deactivate your account (deactivation is not erasure; some records are append-only and are handled through a reviewed request). AI is off unless the owner approves it, and nothing you enter is used to train AI.",
    links: [link("Settings", "/app/settings")] },
  { id: "language", title: "Can I change the language?", keywords: ["language", "sinhala", "tamil", "german", "english", "translate", "translation", "switch language"],
    answer: "Yes. In Settings, choose English, Sinhala, Tamil or German. Many screens are translated; some are still English only, and the translations are drafts that need native review. This help assistant answers in English only.",
    links: [link("Settings", "/app/settings")] },
  { id: "notifications", title: "How do I see reminders and activity?", keywords: ["notification", "notifications", "reminder", "reminders", "activity", "alerts", "expiry reminder", "timeline", "email notification"],
    answer: "Notifications lists activity you are allowed to see and reminders such as shares or agreements about to expire. Email and phone push alerts are not connected yet, so check the app. Some categories can be hidden on this device; case responses and appeals can never be hidden.",
    links: [link("Notifications", "/app/notifications")] },
  { id: "demo", title: "Is this a demonstration? What data should I enter?", keywords: ["demo", "demonstration", "exhibition", "visitor", "test account", "synthetic", "real data", "should i enter", "staging", "trial"],
    answer: "This may be a demonstration or test site. Please do not enter real personal details, national ID numbers, bank details or passwords. Use made-up example data. Demo accounts can be reset, and nothing you enter is used to train AI.",
    links: [link("About ORYQEN", "/about")] },
  { id: "not-available", title: "What is not available yet?", keywords: ["not available", "coming soon", "planned", "missing", "challenge arena", "challenges", "career analysis", "interview", "linkedin", "payment", "pay for", "premium", "price", "pricing", "subscription", "android app", "mobile app", "cover letter", "skills assessment", "analytics"],
    answer: "Not built yet: the AI Challenge Arena (skill challenges and scoring), AI career analysis and AI-written CVs or cover letters, interview practice, LinkedIn connection, payments and paid plans, organization analytics, and a finished signed Android app (an early preview exists). These are planned, not available. Live AI offer analysis exists in the code but is switched off until the owner approves it.",
    links: [link("About ORYQEN", "/about")] },
  { id: "support", title: "How do I contact support?", keywords: ["support", "contact", "contact us", "help desk", "customer service", "email support", "report bug", "bug", "feedback", "complaint to oryqen"],
    answer: "There is no support inbox or ticket system yet. For now, tell the person who gave you access to ORYQEN, and use the private report options inside the app for suspicious listings. This assistant cannot send messages to anyone.",
    links: [link("About ORYQEN", "/about")] },
];

const stop = new Set(["a", "an", "the", "i", "me", "my", "we", "you", "your", "do", "does", "did", "is", "are", "am", "was", "to", "of", "in", "on", "for", "and", "or", "it", "this", "that", "with", "can", "how", "what", "why", "when", "where", "please", "want", "need", "would", "like", "get", "use", "be", "have", "has", "so", "not"]);
const clean = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (text: string) => clean(text).split(" ").filter(word => word && !stop.has(word));
const singular = (word: string) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word);

export function scoreEntry(entry: HelpEntry, question: string) {
  const padded = ` ${clean(question)} `;
  const words = new Set(tokens(question).map(singular));
  let score = 0;
  for (const keyword of entry.keywords) {
    const key = clean(keyword);
    if (!key) continue;
    const keyWords = tokens(key).map(singular);
    if (key.includes(" ")) {
      // A phrase counts when it appears as written, or when all of its meaningful words are in the question ("add an offer" matches "add offer").
      if (padded.includes(` ${key} `) || (keyWords.length >= 2 && keyWords.every(word => words.has(word)))) score += 3;
    } else if (words.has(singular(key)) || padded.includes(` ${key} `)) score += key.length <= 2 ? 1 : 3;
  }
  const titleWords = tokens(entry.title).map(singular);
  score += Math.min(2, titleWords.filter(word => words.has(word)).length);
  return score;
}

export type HelpAnswer = { entry: HelpEntry; related: HelpEntry[] } | null;
// The best entry is returned only when it clearly matches; otherwise null, so the assistant says it does not know instead of guessing.
export function answerQuestion(question: string): HelpAnswer {
  const text = question.trim().slice(0, 300);
  if (tokens(text).length === 0) return null;
  const ranked = helpEntries.map(entry => ({ entry, score: scoreEntry(entry, text) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (!ranked.length || ranked[0]!.score < 3) return null;
  return { entry: ranked[0]!.entry, related: ranked.slice(1).filter(item => item.score >= 2).slice(0, 2).map(item => item.entry) };
}

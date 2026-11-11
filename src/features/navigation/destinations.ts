import type { MessageKey } from "@/i18n";

// Every place a signed-in person can go, in one list, so the command palette and any future launcher agree with the navigation. Labels are message keys; `words` are extra English
// search terms (things people type that are not in the label). Only routes that exist are listed; nothing here grants access, the destination screen still enforces its own rules.
export type Destination = { href: string; label: MessageKey; group: "main" | "career" | "offers" | "work" | "organization" | "account" | "demo"; words: string };

export const destinations: readonly Destination[] = [
  { href: "/app/home", label: "nav.home", group: "main", words: "dashboard start overview" },
  { href: "/app/add-offer", label: "flow.add", group: "offers", words: "new offer paste analyze analysis job offer contract" },
  { href: "/app/scan", label: "nav.scan", group: "offers", words: "screenshot photo image ocr read" },
  { href: "/app/check", label: "nav.check", group: "offers", words: "review findings assessment score saved offer" },
  { href: "/app/agreement-workflow", label: "nav.agreements", group: "offers", words: "agreement contract confirm acknowledge sign" },
  { href: "/app/salary", label: "nav.salary", group: "offers", words: "pay compare benchmark wage range median" },
  { href: "/app/opportunities", label: "nav.opportunities", group: "career", words: "jobs listings vacancies apply discover search" },
  { href: "/app/applications", label: "nav.applications", group: "career", words: "applied tracker follow up status" },
  { href: "/app/interviews", label: "nav.interviews", group: "career", words: "interview schedule calendar feedback outcome" },
  { href: "/app/cv", label: "nav.cv", group: "career", words: "resume curriculum analyzer ats" },
  { href: "/app/cover-letter", label: "nav.coverLetter", group: "career", words: "letter application write" },
  { href: "/app/portfolio", label: "nav.portfolio", group: "career", words: "projects certificates achievements work samples" },
  { href: "/app/career-explorer", label: "nav.careerExplorer", group: "career", words: "skills gap roadmap path roles" },
  { href: "/app/career-assistant", label: "nav.careerAssistant", group: "career", words: "ask advice guidance copilot questions" },
  { href: "/app/work-record", label: "nav.record", group: "work", words: "hours work log evidence vault upload documents" },
  { href: "/app/passport", label: "nav.passport", group: "work", words: "verified work credentials share qr trust chain" },
  { href: "/app/workroom", label: "nav.workroom", group: "work", words: "projects tasks milestones plan" },
  { href: "/app/cases", label: "nav.cases", group: "work", words: "dispute concern appeal report problem" },
  { href: "/app/applicants", label: "nav.applicants", group: "organization", words: "employer candidates shortlist review hiring organization" },
  { href: "/app/employers-demo", label: "nav.employersDemo", group: "organization", words: "company profile employer sample" },
  { href: "/app/notifications", label: "nav.notifications", group: "account", words: "alerts reminders feed" },
  { href: "/app/guidance", label: "nav.guidance", group: "account", words: "private guidance help thread" },
  { href: "/app/help", label: "nav.help", group: "account", words: "help how do i support faq" },
  { href: "/app/settings", label: "nav.settings", group: "account", words: "account language security plan developer api privacy export password" },
  { href: "/app/demo", label: "nav.demo", group: "demo", words: "sample records load reset exhibition" },
];

export type RankedDestination = Destination & { text: string };

// Simple, predictable matching: every typed word must appear in the label or the search terms. Label matches rank above term matches, and a label that starts with the query ranks first.
export function searchDestinations(list: readonly RankedDestination[], query: string): RankedDestination[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...list];
  const scored = list.map((item, index) => {
    const label = item.text.toLowerCase(), all = `${label} ${item.words}`;
    if (!words.every(word => all.includes(word))) return null;
    const score = (label.startsWith(words[0]!) ? 0 : words.every(word => label.includes(word)) ? 1 : 2) * 1000 + index;
    return { item, score };
  }).filter((entry): entry is { item: RankedDestination; score: number } => entry !== null);
  return scored.sort((a, b) => a.score - b.score).map(entry => entry.item);
}

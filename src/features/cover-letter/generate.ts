// Template-based cover letter. Pure text assembly from what the person typed: no AI, no invented facts, nothing is sent anywhere.
export type CoverLetterInput = { name: string; role: string; organization: string; contact: string; opening: string; strengths: string[]; example: string; closing: string; tone: "formal" | "friendly" };
export const coverLetterTones = ["formal", "friendly"] as const;

export function generateCoverLetter(input: CoverLetterInput): { text: string; missing: string[] } {
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  const name = clean(input.name), role = clean(input.role), organization = clean(input.organization), contact = input.contact.trim();
  const strengths = input.strengths.map(clean).filter(Boolean).slice(0, 6), example = clean(input.example), opening = clean(input.opening), closing = clean(input.closing);
  const missing: string[] = [];
  if (!name) missing.push("name");
  if (!role) missing.push("role");
  if (!organization) missing.push("organization");
  if (!strengths.length) missing.push("strengths");
  const formal = input.tone === "formal";
  const list = strengths.length <= 1 ? strengths.join("") : `${strengths.slice(0, -1).join(", ")} and ${strengths[strengths.length - 1]}`;
  const parts = [
    formal ? `Dear ${organization ? `${organization} hiring team` : "hiring team"},` : `Hello ${organization ? `${organization} team` : "team"},`,
    opening || (role ? `I am writing to apply for the ${role} position${organization ? ` at ${organization}` : ""}.` : "I am writing to apply for a position with you."),
    strengths.length ? `${formal ? "My relevant strengths are" : "What I can bring is"} ${list}.` : "",
    example ? `For example: ${example}${/[.!?]$/.test(example) ? "" : "."}` : "",
    closing || (formal ? "Thank you for considering my application. I would welcome the chance to discuss it with you." : "Thanks for reading. I would be glad to chat whenever suits you."),
    formal ? "Yours sincerely," : "Kind regards,",
    [name, contact].filter(Boolean).join("\n"),
  ];
  return { text: parts.filter(Boolean).join("\n\n"), missing };
}

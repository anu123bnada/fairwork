"use client";
import { useI18n } from "@/i18n/use-i18n";
import Link from "next/link";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { employmentPage, type EmploymentPage } from "@/features/work/employment-schema";
import { summarizeSkills, type SkillSummary } from "@/features/work/skills";

// Owner-only view. These skills come from the user's own employment history and are
// never verified, exported or shared from here; the verified Work Passport above is separate.
export function SelfReportedSkills() {
  const { t } = useI18n();
  const [skills, setSkills] = useState<SkillSummary[] | null>(null), [error, setError] = useState(""), [entries, setEntries] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      const items: EmploymentPage["items"] = []; let cursor: string | null = null;
      for (let page = 0; page < 5; page++) {
        const next = employmentPage.parse(await appRequest(`/api/v1/me/employment-history${cursor ? `?cursor=${cursor}` : ""}`));
        items.push(...next.items); cursor = next.nextCursor; if (!cursor) break;
      }
      if (active) { setEntries(items.length); setSkills(summarizeSkills(items, new Date())); }
    })().catch(() => { if (active) setError("Self-reported skills could not be loaded. Retry when connected."); });
    return () => { active = false; };
  }, []);
  return <section className="fw-list-card" aria-label="Self-reported skills">
    <h3>{t("skills.title")}</h3>
    <p>Built only from the employment entries you wrote. They are private to you, are not part of the verified Passport and are not shared when you share it. Overlapping jobs are counted separately.</p>
    {error && <p role="alert">{error}</p>}
    {!skills && !error && <p role="status">Loading…</p>}
    {skills?.length === 0 && <p>{entries === 0 ? "No employment history yet." : "Your entries list no skills yet."} <Link href="/app/work-record">Add skills in Employment history</Link></p>}
    <ul>{skills?.map(item => <li key={item.skill}><strong>{item.skill}</strong> · about {item.months} month{item.months === 1 ? "" : "s"} · {item.roles.map(r => `${r.role} at ${r.employer}`).join("; ")} · <em>self-reported</em></li>)}</ul>
  </section>;
}

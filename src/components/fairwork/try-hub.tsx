"use client";
import Link from "next/link";
import { useState } from "react";
import { moduleGuide, modeLabel } from "@/features/demo/module-guide";
import { CareerAssistant } from "./career-assistant";
import { CareerExplorer } from "./career-explorer";
import { EmployerDemo } from "./employer-demo";
import { OrgDemo } from "./org-demo";
import { RecruiterCheck } from "./recruiter-check";
import { SalaryCompare } from "./salary-compare";
import "./records.css";

type Role = "worker" | "employer" | "recruiter";
const demos: Record<Role, { id: string; label: string; render: () => React.ReactNode }[]> = {
  worker: [
    { id: "career", label: "Career explorer and skill gap", render: () => <CareerExplorer anonymous /> },
    { id: "assistant", label: "Career assistant (DEMO)", render: () => <CareerAssistant /> },
    { id: "salary", label: "Salary comparison", render: () => <SalaryCompare /> },
    { id: "employers", label: "Sample employers", render: () => <EmployerDemo /> },
  ],
  employer: [
    { id: "org", label: "Organization sandbox (both sides)", render: () => <OrgDemo /> },
    { id: "employers", label: "Sample employer profiles", render: () => <EmployerDemo /> },
  ],
  recruiter: [{ id: "check", label: "Recruiter message check", render: () => <RecruiterCheck /> }],
};
const roleText: Record<Role, string> = {
  worker: "Explore careers, compare an offer with salary points you add, ask the demo assistant, and look at sample employers.",
  employer: "See both sides of the applicant workflow with fictional applicants. The real employer tools need an approved organization account, which is never granted from this page.",
  recruiter: "Paste a recruiter message to see which wording deserves a second look. It is a check on wording, not a verdict on anyone.",
};

// Public exhibition entry. Everything here runs on the visitor's device with no account: no sign-in is bypassed, no account data is read, nothing is sent, and the real product stays behind
// its normal sign-in and permissions. Pieces that need an account or an independent counterpart are listed honestly in the module guide below.
export function TryHub({ initialRole, initialDemo }: { initialRole: Role; initialDemo: string }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [demo, setDemo] = useState(initialDemo);
  const list = demos[role];
  const active = list.find(item => item.id === demo) ?? list[0]!;
  return <div className="oq-rec" style={{ maxWidth: 980, margin: "0 auto", padding: "0 16px 64px" }}>
    <h1>Try ORYQEN</h1>
    <p className="oq-demo-banner" role="note" data-demo="sample"><strong>EXHIBITION DEMO.</strong> No account needed. Everything on this page runs on your device with fictional or sample data, nothing is sent anywhere, and nothing here is verified. The real product needs an account and normal permissions.</p>
    <p><Link href="/sign-in">Sign in</Link> · <Link href="/register">Create an account</Link> · <Link href="/downloads">Apps and downloads</Link></p>
    <div className="oq-rec-chips" role="group" aria-label="Choose a visitor role">
      {(["worker", "employer", "recruiter"] as const).map(option => <button key={option} className="fw-secondary" aria-pressed={role === option} onClick={() => { setRole(option); setDemo(demos[option][0]!.id); }}>{option === "worker" ? "I am a worker" : option === "employer" ? "I am an employer" : "I am a recruiter"}</button>)}
    </div>
    <p>{roleText[role]}</p>
    <div className="oq-rec-chips" role="group" aria-label="Choose a demonstration">
      {list.map(item => <button key={item.id} className="fw-secondary" aria-pressed={active.id === item.id} onClick={() => setDemo(item.id)}>{item.label}</button>)}
    </div>
    <div>{active.render()}</div>
    <h2 id="modules">All 22 modules: where to see each</h2>
    <p>Each module is either the real product (sign in), a demo you can try here, real but needing an independent counterpart account, or protected. Nothing is labelled verified.</p>
    <table aria-label="Module guide"><thead><tr><th scope="col">#</th><th scope="col">Module</th><th scope="col">How to see it</th><th scope="col">Status and honest note</th></tr></thead><tbody>
      {moduleGuide.map(entry => <tr key={entry.n}>
        <td>{entry.n}</td><td>{entry.module}</td>
        <td>{entry.mode === "protected" ? <span>{entry.where}</span> : <Link href={entry.href}>{entry.where}</Link>}</td>
        <td><strong>{modeLabel[entry.mode]}.</strong> {entry.note}</td>
      </tr>)}
    </tbody></table>
  </div>;
}

import Link from "next/link";
import { PageShell } from "@/components/fairwork/page-shell";
export const metadata = { title: "About this build" };
export default function About() {
  return <PageShell><article className="oq-about"><h1>ORYQEN</h1><p>Pronounced OR-i-ken.</p>
    <h2>Your work, clearly recorded.</h2><p>Understand offers, clarify agreements and keep a private work record.</p>
    <h2>Development build · synthetic data only</h2><p>This build is for controlled testing. Do not enter real employment records. Independent confirmations and case decisions are restricted by the server; a demonstration is not proof of a real employer or independent human review.</p>
    <h2>Privacy and availability</h2><p>Passport history is private. Public sharing, file uploads and notification delivery are not available. Authentication is handled by the configured Supabase service.</p>
    <p>Production terms, privacy notices, operator contact and retention procedures must be approved and configured before public onboarding. This page is a build notice, not a production privacy policy.</p>
    <Link href="/welcome">Return to sign in</Link></article></PageShell>;
}

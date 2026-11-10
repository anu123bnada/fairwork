import { PageShell } from "@/components/fairwork/page-shell";
import { TryHub } from "@/components/fairwork/try-hub";

export const metadata = { title: "Try ORYQEN: exhibition demo" };
type Role = "worker" | "employer" | "recruiter";
const roles: readonly string[] = ["worker", "employer", "recruiter"];

// Public, no account: only device-local demonstrations and an honest guide to the 22 modules. It reads no account data and grants nothing.
export default async function TryPage({ searchParams }: { searchParams: Promise<{ tab?: string; demo?: string }> }) {
  const params = await searchParams;
  const role = (roles.includes(params.tab ?? "") ? params.tab : "worker") as Role;
  return <PageShell><TryHub initialRole={role} initialDemo={typeof params.demo === "string" ? params.demo.slice(0, 20) : ""} /></PageShell>;
}

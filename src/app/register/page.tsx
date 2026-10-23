import Link from "next/link";
import { AuthShell } from "@/components/fairwork/auth-shell";
import { RegistrationForm } from "@/components/fairwork/registration-form";

export const dynamic = "force-dynamic";
export default function RegisterPage() {
  return <AuthShell title="Register with ORYQEN">
    <p>Controlled integration testing · Synthetic employment data only.</p>
    {process.env.AUTH_REGISTRATION_ENABLED === "true" ? <RegistrationForm /> : <p>Registration is not enabled for this build.</p>}
    <p>Worker and employer accounts register separately. Employer authority requires a separate reviewed company membership.</p>
    <Link href="/sign-in">Back to sign in</Link>
  </AuthShell>;
}

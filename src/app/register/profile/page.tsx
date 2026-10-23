import Link from "next/link";
import { AuthShell } from "@/components/fairwork/auth-shell";
import { RegistrationForm } from "@/components/fairwork/registration-form";

export const dynamic = "force-dynamic";
export default function RegistrationProfilePage() {
  return <AuthShell title="Your ORYQEN profile">
    <p>Confirm your email and sign in first. Creating a profile grants no company membership.</p>
    {process.env.AUTH_REGISTRATION_ENABLED === "true" ? <RegistrationForm profile /> : <p>Registration is not enabled for this build.</p>}
    <Link href="/sign-in">Back to sign in</Link>
  </AuthShell>;
}

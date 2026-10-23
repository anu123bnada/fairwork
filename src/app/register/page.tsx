import { AuthLink } from "@/components/fairwork/auth-link";
import { AuthShell } from "@/components/fairwork/auth-shell";
import { RegistrationForm } from "@/components/fairwork/registration-form";

export const dynamic = "force-dynamic";
export default function RegisterPage() {
  return <AuthShell title="Create your account">
    <p>Controlled integration testing · Synthetic employment data only.</p>
    {process.env.AUTH_REGISTRATION_ENABLED === "true" ? <RegistrationForm /> : <><p className="fw-auth-note">Registration is not enabled for this build.</p><AuthLink href="/sign-in">Back to sign in</AuthLink></>}
  </AuthShell>;
}

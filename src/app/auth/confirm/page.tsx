import { AuthLink } from "@/components/fairwork/auth-link";
import { AuthShell } from "@/components/fairwork/auth-shell";
import { RegistrationForm } from "@/components/fairwork/registration-form";

export const dynamic = "force-dynamic";
export default function ConfirmPage() {
  return <AuthShell title="Confirm your ORYQEN email">
    {process.env.AUTH_REGISTRATION_ENABLED === "true" ? <RegistrationForm confirmation /> : <><p>Email confirmation is not enabled for this build.</p><AuthLink href="/sign-in">Back to sign in</AuthLink></>}
  </AuthShell>;
}

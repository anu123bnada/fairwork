import { AuthLink } from "@/components/fairwork/auth-link";
import { createServerSupabase } from "@/server/supabase";
import { AuthShell } from "@/components/fairwork/auth-shell";
import { RegistrationForm } from "@/components/fairwork/registration-form";

export const dynamic = "force-dynamic";
export default async function RegistrationProfilePage() {
  let displayName = "";
  if (process.env.AUTH_REGISTRATION_ENABLED === "true") {
    try {
      const client = await createServerSupabase();
      const { data } = await client.auth.getUser();
      const name = data.user?.user_metadata?.display_name;
      if (typeof name === "string") displayName = name.slice(0, 80);
    } catch { /* Optional display-only prefill. Profile writes still require verified auth. */ }
  }
  return <AuthShell title="Your ORYQEN profile">
    <p>Confirm your email and sign in first. Creating a profile grants no company membership.</p>
    {process.env.AUTH_REGISTRATION_ENABLED === "true" ? <RegistrationForm profile displayName={displayName} /> : <><p>Registration is not enabled for this build.</p><AuthLink href="/sign-in">Back to sign in</AuthLink></>}
  </AuthShell>;
}

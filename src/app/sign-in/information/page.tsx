import Link from "next/link";
import { AppBrandHeader } from "@/components/brand/brand";
import { participantAuthQuery } from "@/features/offer/participant-path";
import "@/components/fairwork/auth-composition.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign-in information" };

export default async function SignInInformation({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["offerId", "workflowId", "workId", "caseId", "grantId", "agreementBasisId", "workspace"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  const suffix = participantAuthQuery(query.toString());
  const from = params.from === "welcome" ? "/welcome" : params.from === "otp" ? "/otp" : "/sign-in";
  const back = `${from}${suffix ? `?${suffix}` : ""}`;
  return <main id="main" className="fw-auth-information" tabIndex={-1}>
    <AppBrandHeader />
    <Link href={back}>{from === "/otp" ? "Back to authenticator" : "Back to sign in"}</Link>
    <h1>ORYQEN sign-in information</h1>
    <h2>Test accounts only</h2>
    <p>This development build is for test accounts and synthetic data only. Do not enter real employment records. {process.env.AUTH_REGISTRATION_ENABLED === "true" ? "Controlled email registration is enabled for integration testing." : "Public account registration is not available."}</p>
    {process.env.AUTH_REGISTRATION_ENABLED === "true" && <Link href="/register">Register a test account</Link>}
    <h2>Email and password</h2>
    <p>Sign-in uses your account email and password through Supabase. ORYQEN does not send or simulate SMS codes. Phone-number sign-in and phone OTP are not implemented in this build.</p>
    <h2>Authenticator verification</h2>
    <p>The six-digit code comes from an authenticator app enrolled on your signed-in account. It is a separate MFA check for actions that require it, not an SMS login. A verified factor and the required server-side permissions are still necessary.</p>
    <h2>Privacy and availability</h2>
    <p>The original design shows a phone/SMS flow. This build preserves real authentication instead of presenting an unsupported phone form or resend countdown. A demo does not establish real employer identity or independent human verification.</p>
    <p>Production terms, privacy notices, operator contact and retention procedures remain pending. This page is a development notice, not a production privacy policy or an agreement to unpublished terms.</p>
    <Link href="/about">About this build and privacy</Link><br />
    <Link href={back}>{from === "/otp" ? "Back to authenticator" : "Return to sign in"}</Link>
  </main>;
}

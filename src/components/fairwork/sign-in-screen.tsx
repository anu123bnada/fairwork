import Link from "next/link";
import { AuthShell } from "./auth-shell";
import { SecureSignInForm } from "./secure-sign-in-form";
import { AuthInformationLink } from "./auth-information-link";
import "./auth-composition.css";
import { AuthLink } from "./auth-link";

export function SignInScreen() {
  return <AuthShell title="Welcome to ORYQEN" signIn>
    <Link className="fw-sign-in-back" href="/intro/language" aria-label="Back to language">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
    </Link>
    <p className="fw-auth-subtitle">Email/password sign-in. SMS unavailable.</p>
    <nav className="fw-auth-tabs" aria-label="Account access"><span aria-current="page">Sign in</span><AuthLink href="/register">Create account</AuthLink></nav>
    <SecureSignInForm />
    <div className="fw-sign-in-information">
      <p className="fw-sign-in-notice">Test accounts only · Synthetic data only</p>
      <AuthInformationLink />
    </div>
    <p className="fw-sign-in-employer"><Link href="/app/employer">I’m an employer →</Link></p>
  </AuthShell>;
}

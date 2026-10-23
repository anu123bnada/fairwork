import Link from "next/link";
import { AuthShell } from "@/components/fairwork/auth-shell";
import { RecoveryForm } from "@/components/fairwork/recovery-form";
export default function ForgotPasswordPage() {
  return <AuthShell title="Recover your account"><RecoveryForm/><p><Link href="/sign-in">Back to sign in</Link></p></AuthShell>;
}

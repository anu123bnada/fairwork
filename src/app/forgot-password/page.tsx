import { AuthShell } from "@/components/fairwork/auth-shell";
import { RecoveryForm } from "@/components/fairwork/recovery-form";
export default function ForgotPasswordPage() {
  return <AuthShell title="Recover your account"><p>We’ll help you get back to your private workspace.</p><RecoveryForm/></AuthShell>;
}

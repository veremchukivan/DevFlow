import { AuthRecovery } from "@/components/auth-recovery";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <AuthRecovery mode="reset" token={(await params).token} />;
}

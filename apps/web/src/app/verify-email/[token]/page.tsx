import { AuthRecovery } from "@/components/auth-recovery";

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <AuthRecovery mode="verify" token={(await params).token} />;
}

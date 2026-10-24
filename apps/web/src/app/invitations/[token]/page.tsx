import { InvitationPage } from "@/components/invitation-page";

export default async function WorkspaceInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <InvitationPage token={(await params).token} />;
}

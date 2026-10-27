import { InvitationPage } from "@/features/invitations/components/invitation-page";

export default async function InvitationByIdPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  return <InvitationPage byId token={(await params).invitationId} />;
}

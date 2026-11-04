import { WorkspaceCalls } from "@/features/workspaces/components/workspace-calls";

export default async function WorkspaceCallsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <WorkspaceCalls workspaceId={workspaceId} />;
}

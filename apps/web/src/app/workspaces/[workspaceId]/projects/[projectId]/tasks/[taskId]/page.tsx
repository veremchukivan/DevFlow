import { redirect } from "next/navigation";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string; workspaceId: string }>;
}) {
  const { projectId, taskId, workspaceId } = await params;
  redirect(`/workspaces/${workspaceId}/projects/${projectId}?taskId=${taskId}`);
}

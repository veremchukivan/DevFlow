import type { ReactNode } from "react";

import { WorkspaceSettingsLayout } from "@/features/workspaces/components/workspace-settings-layout";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <WorkspaceSettingsLayout>{children}</WorkspaceSettingsLayout>;
}

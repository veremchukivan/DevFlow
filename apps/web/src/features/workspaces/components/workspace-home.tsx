"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiClientError, getWorkspaces } from "@/shared/lib/api-client";
import styles from "@/shared/styles/ui.module.css";

export function WorkspaceHome() {
  const router = useRouter();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    void getWorkspaces({ limit: 1 })
      .then((response) => {
        if (!active) return;
        const workspace = response.workspaces[0];
        if (workspace) {
          router.replace(`/workspaces/${workspace.id}`);
          return;
        }
        setError(
          "Your workspace is being prepared. Refresh this page in a moment.",
        );
      })
      .catch((caughtError: unknown) => {
        if (!active) return;
        setError(
          caughtError instanceof ApiClientError
            ? caughtError.message
            : "Unable to open your workspace.",
        );
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className={styles.loading}>{error ?? "Opening your workspace"}</main>
  );
}

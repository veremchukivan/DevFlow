"use client";

import Link from "next/link";
import { useEffect } from "react";

import styles from "./system-page.module.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page rendering failed", error);
  }, [error]);

  return (
    <main className={styles.page}>
      <p className={styles.code}>Something went wrong</p>
      <h1>We could not load this page</h1>
      <p>Try again. If the issue continues, return to your workspaces.</p>
      <div className={styles.actions}>
        <button className={styles.secondaryButton} onClick={reset} type="button">
          Try again
        </button>
        <Link className={styles.primaryLink} href="/workspaces">
          Go to workspaces
        </Link>
      </div>
    </main>
  );
}

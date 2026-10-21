"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { logout } from "@/lib/api-client";
import type { AuthUser } from "@devflow/shared";

import styles from "./site-header.module.css";

export function SiteHeader({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);

    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
      setIsSigningOut(false);
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.content}>
        <Link className={styles.brand} href="/">
          DevFlow
        </Link>
        <nav aria-label="Primary navigation" className={styles.navigation}>
          <Link
            aria-current={pathname === "/" ? "page" : undefined}
            className={styles.navigationLink}
            href="/"
          >
            Workspaces
          </Link>
        </nav>
        <div className={styles.userMenu}>
          <span className={styles.userName}>{user.displayName}</span>
          <button
            className={styles.signOut}
            disabled={isSigningOut}
            onClick={signOut}
            type="button"
          >
            {isSigningOut ? "Signing out" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}

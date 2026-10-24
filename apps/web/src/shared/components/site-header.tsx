"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Plus } from "lucide-react";
import Link from "next/link";

import { logout } from "@/shared/lib/api-client";
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
        <div className={styles.mobileBrand}>DevFlow</div>
        <div className={styles.breadcrumb}>
          {pathname === "/workspaces" ? "Workspaces" : "Project workspace"}
        </div>
        <div className={styles.userMenu}>
          <Link className={styles.createButton} href="/workspaces">
            <Plus aria-hidden="true" size={18} strokeWidth={2} />
            Create
          </Link>
          <Link
            aria-label="Profile settings"
            className={styles.userAvatar}
            href="/profile"
            title="Profile settings"
          >
            {user.displayName.slice(0, 2).toUpperCase()}
          </Link>
          <button
            aria-label="Sign out"
            className={styles.signOut}
            disabled={isSigningOut}
            onClick={signOut}
            title="Sign out"
            type="button"
          >
            <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}

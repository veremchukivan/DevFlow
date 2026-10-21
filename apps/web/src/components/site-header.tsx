"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Plus } from "lucide-react";
import Link from "next/link";

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
        <div className={styles.mobileBrand}>DevFlow</div>
        <div className={styles.breadcrumb}>
          {pathname === "/" ? "Workspaces" : "Project workspace"}
        </div>
        <div className={styles.userMenu}>
          <Link className={styles.createButton} href="/">
            <Plus aria-hidden="true" size={18} strokeWidth={2} />
            Create
          </Link>
          <span aria-label={user.displayName} className={styles.userAvatar}>
            {user.displayName.slice(0, 2).toUpperCase()}
          </span>
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

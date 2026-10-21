"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { logout } from "@/lib/api-client";
import type { AuthUser } from "@devflow/shared";

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
    <header className="site-header">
      <div className="site-header-content">
        <Link className="site-brand" href="/">
          DevFlow
        </Link>
        <nav aria-label="Primary navigation" className="site-navigation">
          <Link
            aria-current={pathname === "/" ? "page" : undefined}
            className="site-navigation-link"
            href="/"
          >
            Workspaces
          </Link>
        </nav>
        <div className="site-user-menu">
          <span className="site-user-name">{user.displayName}</span>
          <button
            className="header-sign-out"
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

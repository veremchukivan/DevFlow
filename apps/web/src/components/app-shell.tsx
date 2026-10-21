"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { ApiClientError, getCurrentUser, logout } from "@/lib/api-client";
import type { AuthUser } from "@devflow/shared";

const publicPaths = new Set(["/login", "/register"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isPublicPage = publicPaths.has(pathname);

  useEffect(() => {
    if (isPublicPage) {
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    void getCurrentUser()
      .then((response) => {
        if (active) setUser(response.user);
      })
      .catch((error: unknown) => {
        if (
          error instanceof ApiClientError &&
          error.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }

        router.replace("/login?reason=unavailable");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isPublicPage, router]);

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

  if (isPublicPage) return <>{children}</>;

  if (isLoading || !user) {
    return <main className="session-loading">Loading DevFlow</main>;
  }

  return (
    <div className="app-shell">
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
      <div className="app-content">{children}</div>
      <footer className="site-footer">
        <div className="site-footer-content">
          <span>DevFlow</span>
          <span>Workspace and project management</span>
        </div>
      </footer>
    </div>
  );
}

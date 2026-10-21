"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiClientError, getCurrentUser, logout } from "@/lib/api-client";
import type { AuthUser } from "@devflow/shared";

export function SessionHome() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    void getCurrentUser()
      .then((response) => {
        if (active) {
          setUser(response.user);
        }
      })
      .catch((error: unknown) => {
        if (
          error instanceof ApiClientError &&
          error.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }

        if (active) {
          router.replace("/login?reason=unavailable");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    setIsSigningOut(true);

    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (isLoading || !user) {
    return <main className="session-loading">Loading your workspace</main>;
  }

  return (
    <main className="workspace-home">
      <header className="workspace-home-header">
        <div>
          <p className="eyebrow">DevFlow</p>
          <h1>Welcome, {user.displayName}</h1>
          <p>Your workspaces will appear here.</p>
        </div>
        <button
          className="secondary-button"
          disabled={isSigningOut}
          onClick={signOut}
          type="button"
        >
          {isSigningOut ? "Signing out" : "Sign out"}
        </button>
      </header>
    </main>
  );
}

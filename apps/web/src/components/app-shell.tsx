"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { ApiClientError, getCurrentUser } from "@/lib/api-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { AuthUser } from "@devflow/shared";

import styles from "./app-shell.module.css";

const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser>();
  const [isLoading, setIsLoading] = useState(true);
  const isPublicPage = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

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

  if (isPublicPage) return <>{children}</>;

  if (isLoading || !user) {
    return <main className={styles.loading}>Loading DevFlow</main>;
  }

  return (
    <div className={styles.shell}>
      <SiteHeader user={user} />
      <div className={styles.content}>{children}</div>
      <SiteFooter />
    </div>
  );
}

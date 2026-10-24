import type { Metadata } from "next";

import { AppShell } from "@/shared/components/app-shell";

import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "DevFlow",
  description: "Project management workspace",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

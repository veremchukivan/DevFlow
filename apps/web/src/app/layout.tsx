import type { Metadata } from "next";

import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}

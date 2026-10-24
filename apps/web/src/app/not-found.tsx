import Link from "next/link";

import styles from "./system-page.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <p className={styles.code}>404</p>
      <h1>This page is not available</h1>
      <p>The link may be outdated, or the page may have been moved.</p>
      <div className={styles.actions}>
        <Link className={styles.primaryLink} href="/">
          Go to home
        </Link>
      </div>
    </main>
  );
}

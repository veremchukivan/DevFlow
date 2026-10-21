import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <span>DevFlow</span>
        <span>Workspace and project management</span>
      </div>
    </footer>
  );
}

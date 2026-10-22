import { ArrowRight, Check, LayoutDashboard, UsersRound } from "lucide-react";
import Link from "next/link";

import styles from "./landing-page.module.css";

const columns = [
  {
    title: "Planned",
    count: 3,
    tasks: ["Define product scope", "Prepare onboarding"],
  },
  {
    title: "In progress",
    count: 2,
    tasks: ["Workspace navigation", "Task activity feed"],
  },
  { title: "Review", count: 1, tasks: ["Design system update"] },
];

export function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link aria-label="DevFlow home" className={styles.brand} href="/">
          <span className={styles.brandMark}>D</span>
          <span>DevFlow</span>
        </Link>
        <nav aria-label="Main navigation" className={styles.navigation}>
          <a href="#product">Product</a>
          <a href="#workflow">Workflow</a>
        </nav>
        <div className={styles.actions}>
          <Link className={styles.signIn} href="/login">
            Sign in
          </Link>
          <Link className={styles.getStarted} href="/register">
            Get started <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </header>

      <section className={styles.hero} id="product">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>A calmer way to deliver work</p>
          <h1>Every project, moving in one clear direction.</h1>
          <p className={styles.description}>
            DevFlow gives product teams a shared space for projects, tasks,
            decisions, and the everyday momentum that turns plans into progress.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/register">
              Create a workspace <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className={styles.secondaryAction} href="/login">
              Open DevFlow
            </Link>
          </div>
          <p className={styles.assurance}>
            <Check aria-hidden="true" size={16} /> Start with your team in a few
            minutes
          </p>
        </div>

        <div
          aria-label="DevFlow project board preview"
          className={styles.preview}
        >
          <div className={styles.previewSidebar}>
            <div className={styles.previewLogo}>
              <span>D</span> DevFlow
            </div>
            <p>WORKSPACE</p>
            <strong>Northstar</strong>
            <div className={styles.previewNav}>
              <span>
                <LayoutDashboard size={15} /> Projects
              </span>
              <span>
                <UsersRound size={15} /> Team
              </span>
            </div>
          </div>
          <div className={styles.previewContent}>
            <div className={styles.previewTop}>
              <div>
                <small>Projects / Product launch</small>
                <strong>Website refresh</strong>
              </div>
              <span>March sprint</span>
            </div>
            <div className={styles.progress}>
              <span>68% complete</span>
              <i>
                <b />
              </i>
            </div>
            <div className={styles.board}>
              {columns.map((column) => (
                <section key={column.title}>
                  <header>
                    <span>{column.title}</span>
                    <b>{column.count}</b>
                  </header>
                  {column.tasks.map((task, index) => (
                    <article key={task}>
                      <i
                        className={`${styles.dot} ${index === 1 ? styles.purple : ""}`}
                      />
                      <span>{task}</span>
                      <small>{index + 2}d</small>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.valueSection} id="workflow">
        <p className={styles.eyebrow}>Designed for the work between meetings</p>
        <div className={styles.valueHeading}>
          <h2>See what matters. Keep it moving.</h2>
          <p>
            Bring projects, ownership, and next steps into a workspace your
            whole team can read at a glance.
          </p>
        </div>
        <div className={styles.features}>
          <article>
            <span>01</span>
            <h3>Shape the work</h3>
            <p>
              Create workspaces and projects with a structure that fits your
              team.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Make progress visible</h3>
            <p>
              Keep tasks, statuses, priorities, and due dates close to the work.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Work together</h3>
            <p>Invite teammates and give everyone the right level of access.</p>
          </article>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark}>D</span>
          <span>DevFlow</span>
        </Link>
        <p>Clear work. Shared momentum.</p>
        <Link href="/register">Get started</Link>
      </footer>
    </main>
  );
}

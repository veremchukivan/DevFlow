import { getApiHealth } from "@/lib/api-client";

const metrics = [
  { label: "Active projects", value: "3" },
  { label: "Open tasks", value: "18" },
  { label: "Due this week", value: "5" }
];

const columns = [
  {
    title: "Backlog",
    tasks: [
      { title: "Define workspace roles", meta: "Auth module" },
      { title: "Draft task schema", meta: "Tasks module" }
    ]
  },
  {
    title: "In progress",
    tasks: [{ title: "Monorepo foundation", meta: "Platform" }]
  },
  {
    title: "Done",
    tasks: [{ title: "Architecture direction", meta: "ADR 0001" }]
  }
];

export default async function HomePage() {
  const health = await getApiHealth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">DevFlow</div>
        <nav aria-label="Workspace">
          <ul className="nav-list">
            <li className="nav-item nav-item-active">Overview</li>
            <li className="nav-item">Projects</li>
            <li className="nav-item">Tasks</li>
          </ul>
        </nav>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <h1 className="page-title">Workspace overview</h1>
            <p className="page-subtitle">
              API status: {health.status} · {health.service}
            </p>
          </div>
          <button className="primary-button" type="button">
            New task
          </button>
        </header>

        <section className="workspace-grid" aria-label="Workspace metrics">
          {metrics.map((metric) => (
            <div className="metric" key={metric.label}>
              <p className="metric-label">{metric.label}</p>
              <p className="metric-value">{metric.value}</p>
            </div>
          ))}
        </section>

        <section className="board-preview" aria-label="Project board preview">
          <div className="board-header">
            <h2>Foundation project</h2>
            <span>Sprint 1</span>
          </div>
          <div className="board-columns">
            {columns.map((column) => (
              <div className="board-column" key={column.title}>
                <h3 className="column-title">{column.title}</h3>
                {column.tasks.map((task) => (
                  <article className="task-row" key={task.title}>
                    <p className="task-title">{task.title}</p>
                    <p className="task-meta">{task.meta}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}


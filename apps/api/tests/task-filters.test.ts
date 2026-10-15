import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestProject,
  createTestTask,
  createTestUser,
  createTestWorkspace,
  request
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Task Filtering & Sorting Integration Tests", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let assignee: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let lowTask: Awaited<ReturnType<typeof createTestTask>>;
  let mediumTask: Awaited<ReturnType<typeof createTestTask>>;
  let highTask: Awaited<ReturnType<typeof createTestTask>>;
  let urgentTask: Awaited<ReturnType<typeof createTestTask>>;
  let archivedTask: Awaited<ReturnType<typeof createTestTask>>;

  beforeAll(async () => {
    await cleanupDatabase();

    user = await createTestUser(app, { email: "filter_user@devflow.io" });
    assignee = await createTestUser(app, { email: "filter_assignee@devflow.io" });

    workspace = await createTestWorkspace(app, user.cookie, {
      name: "Filter Workspace",
      slug: "filter-ws"
    });

    // Add assignee to workspace
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", user.cookie)
      .send({ email: assignee.email, role: "member" });

    project = await createTestProject(app, user.cookie, workspace.id, {
      key: "FILT",
      name: "Filter Project"
    });

    // Create tasks with different priorities and assignees
    lowTask = await createTestTask(app, user.cookie, workspace.id, project.id, {
      priority: "low",
      title: "Write documentation"
    });

    mediumTask = await createTestTask(app, user.cookie, workspace.id, project.id, {
      assigneeUserId: assignee.user.id,
      priority: "medium",
      title: "Refactor database client"
    });

    highTask = await createTestTask(app, user.cookie, workspace.id, project.id, {
      assigneeUserId: assignee.user.id,
      priority: "high",
      title: "Setup redis caching"
    });

    urgentTask = await createTestTask(app, user.cookie, workspace.id, project.id, {
      priority: "urgent",
      title: "Fix critical auth exploit"
    });

    archivedTask = await createTestTask(app, user.cookie, workspace.id, project.id, {
      priority: "low",
      title: "Deprecated legacy endpoint"
    });

    // Archive one task
    await request(app)
      .delete(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${archivedTask.id}`
      )
      .set("Cookie", user.cookie)
      .set("If-Match", `"${archivedTask.version}"`);
  });

  afterAll(async () => {
    await closeDbConnection();
  });

  it("filters tasks by priority", async () => {
    const res = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?priority=urgent`
      )
      .set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].id).toBe(urgentTask.id);
  });

  it("filters tasks by assigneeUserId", async () => {
    const res = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?assigneeUserId=${assignee.user.id}`
      )
      .set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
    const titles = res.body.tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain("Refactor database client");
    expect(titles).toContain("Setup redis caching");
  });

  it("filters tasks by unassigned (assigneeUserId=none)", async () => {
    const res = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?assigneeUserId=none`
      )
      .set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    const titles = res.body.tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain("Write documentation");
    expect(titles).toContain("Fix critical auth exploit");
    expect(titles).not.toContain("Refactor database client");
  });

  it("searches tasks by title case-insensitively", async () => {
    const res = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?search=AUTH`
      )
      .set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe("Fix critical auth exploit");
  });

  it("returns archived tasks only when archived=true", async () => {
    // Default: archived tasks are omitted
    const activeRes = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", user.cookie);

    expect(activeRes.status).toBe(200);
    const activeIds = activeRes.body.tasks.map((t: { id: string }) => t.id);
    expect(activeIds).not.toContain(archivedTask.id);

    // Archived: only soft-deleted tasks are returned
    const archivedRes = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?archived=true`
      )
      .set("Cookie", user.cookie);

    expect(archivedRes.status).toBe(200);
    expect(archivedRes.body.tasks).toHaveLength(1);
    expect(archivedRes.body.tasks[0].id).toBe(archivedTask.id);
  });

  it("sorts tasks by priority descending (urgent > high > medium > low)", async () => {
    const res = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?sortBy=priority&sortOrder=desc`
      )
      .set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    const priorities = res.body.tasks.map((t: { priority: string }) => t.priority);
    expect(priorities).toEqual(["urgent", "high", "medium", "low"]);
  });

  it("enriches task with reporter and assignee user objects", async () => {
    const res = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${mediumTask.id}`
      )
      .set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.task.assignee).toEqual({
      displayName: assignee.displayName,
      email: assignee.email,
      id: assignee.user.id
    });
    expect(res.body.task.reporter).toEqual({
      displayName: user.displayName,
      email: user.email,
      id: user.user.id
    });
  });

  it("returns null for assignee when task is unassigned", async () => {
    const res = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${lowTask.id}`
      )
      .set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.task.assignee).toBeNull();
    expect(res.body.task.reporter).toEqual({
      displayName: user.displayName,
      email: user.email,
      id: user.user.id
    });
  });

  it("properly escapes SQL wildcard characters (% and _) in search", async () => {
    // Create tasks with special characters
    await createTestTask(app, user.cookie, workspace.id, project.id, {
      title: "Task 100% complete"
    });
    await createTestTask(app, user.cookie, workspace.id, project.id, {
      title: "Task 1000 items processed"
    });
    await createTestTask(app, user.cookie, workspace.id, project.id, {
      title: "task_special_code"
    });
    await createTestTask(app, user.cookie, workspace.id, project.id, {
      title: "task-special-code"
    });

    // Search with % wildcard: should only match "Task 100% complete", not "Task 1000 items processed"
    const pctRes = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?search=100%`
      )
      .set("Cookie", user.cookie);

    expect(pctRes.status).toBe(200);
    expect(pctRes.body.tasks).toHaveLength(1);
    expect(pctRes.body.tasks[0].title).toBe("Task 100% complete");

    // Search with _ wildcard: should only match "task_special_code", not "task-special-code"
    const underRes = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?search=task_special`
      )
      .set("Cookie", user.cookie);

    expect(underRes.status).toBe(200);
    expect(underRes.body.tasks).toHaveLength(1);
    expect(underRes.body.tasks[0].title).toBe("task_special_code");
  });
});


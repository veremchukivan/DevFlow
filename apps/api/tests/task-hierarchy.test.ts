import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestProject,
  createTestTask,
  createTestUser,
  createTestWorkspace,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Task hierarchy integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "hierarchy-owner@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "task-hierarchy",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "HIER",
      name: "Task hierarchy project",
    });
  });

  afterAll(async () => closeDbConnection());

  it("creates a subtask and exposes its parent in task responses", async () => {
    const parent = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { title: "Parent task" },
    );
    const child = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { parentTaskId: parent.id, title: "Child task" },
    );

    expect(child.parentTaskId).toBe(parent.id);

    const listed = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", owner.cookie);
    const listedChild = listed.body.tasks.find(
      (task: { id: string }) => task.id === child.id,
    );
    expect(listedChild.parentTaskId).toBe(parent.id);
  });

  it("rejects a nested subtask and a task from another project as parent", async () => {
    const parent = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { title: "Nested parent" },
    );
    const child = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { parentTaskId: parent.id, title: "First-level subtask" },
    );

    const nested = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", owner.cookie)
      .send({ parentTaskId: child.id, title: "Nested subtask" });
    expect(nested.status).toBe(400);
    expect(nested.body.error.code).toBe("TASK_PARENT_NESTING_NOT_SUPPORTED");

    const otherProject = await createTestProject(
      app,
      owner.cookie,
      workspace.id,
      {
        key: "OTHER",
        name: "Other project",
      },
    );
    const foreignParent = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      otherProject.id,
      { title: "Foreign parent" },
    );
    const invalidParent = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", owner.cookie)
      .send({ parentTaskId: foreignParent.id, title: "Invalid child" });
    expect(invalidParent.status).toBe(400);
    expect(invalidParent.body.error.code).toBe("TASK_PARENT_INVALID");
  });
});

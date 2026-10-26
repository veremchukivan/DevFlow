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

describe("Task positioning integration tests", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let firstTask: Awaited<ReturnType<typeof createTestTask>>;
  let secondTask: Awaited<ReturnType<typeof createTestTask>>;
  let thirdTask: Awaited<ReturnType<typeof createTestTask>>;

  beforeAll(async () => {
    await cleanupDatabase();
    user = await createTestUser(app);
    workspace = await createTestWorkspace(app, user.cookie);
    project = await createTestProject(app, user.cookie, workspace.id);
    firstTask = await createTestTask(
      app,
      user.cookie,
      workspace.id,
      project.id,
    );
    secondTask = await createTestTask(
      app,
      user.cookie,
      workspace.id,
      project.id,
    );
    thirdTask = await createTestTask(
      app,
      user.cookie,
      workspace.id,
      project.id,
    );
  });

  afterAll(async () => {
    await closeDbConnection();
  });

  it("places a task before another task and persists the manual order", async () => {
    const reposition = await request(app)
      .put(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${thirdTask.id}/position`,
      )
      .set("Cookie", user.cookie)
      .send({ beforeTaskId: firstTask.id, statusId: firstTask.statusId });

    expect(reposition.status).toBe(204);

    const response = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", user.cookie);

    expect(response.status).toBe(200);
    expect(response.body.tasks.map((task: { id: string }) => task.id)).toEqual([
      thirdTask.id,
      firstTask.id,
      secondTask.id,
    ]);
  });

  it("rejects a reference task from another status", async () => {
    const inProgress = project.statuses.find(
      (status) => status.category === "in_progress",
    );
    expect(inProgress).toBeDefined();

    const response = await request(app)
      .put(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${secondTask.id}/position`,
      )
      .set("Cookie", user.cookie)
      .send({ beforeTaskId: firstTask.id, statusId: inProgress?.id });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TASK_POSITION_INVALID");
  });
});

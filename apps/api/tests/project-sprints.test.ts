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

describe("Project sprint integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app);
    workspace = await createTestWorkspace(app, owner.cookie);
    project = await createTestProject(app, owner.cookie, workspace.id);
  });

  afterAll(async () => closeDbConnection());

  it("creates, lists, and completes a project sprint", async () => {
    const created = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({
        endDate: "2026-11-07",
        goal: "Ship the board workflow",
        name: "Sprint 1",
        startDate: "2026-10-24",
        status: "active",
      });

    expect(created.status).toBe(201);
    expect(created.body.sprint.status).toBe("active");

    const listed = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.sprints).toHaveLength(1);

    const completed = await request(app)
      .patch(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/sprints/${created.body.sprint.id}`,
      )
      .set("Cookie", owner.cookie)
      .send({ status: "completed" });
    expect(completed.status).toBe(200);
    expect(completed.body.sprint.completedAt).toEqual(expect.any(String));
  });

  it("allows only one active sprint per project", async () => {
    const active = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({ name: "Sprint 2", status: "active" });
    expect(active.status).toBe(201);

    const duplicate = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie)
      .send({ name: "Sprint 3", status: "active" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("SPRINT_ACTIVE_EXISTS");
  });

  it("filters sprint tasks and prevents deleting a non-empty sprint", async () => {
    const listed = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/sprints`)
      .set("Cookie", owner.cookie);
    const sprint = listed.body.sprints.find(
      (item: { status: string }) => item.status === "active",
    );
    const task = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { sprintId: sprint.id },
    );
    expect(task.sprintId).toBe(sprint.id);

    const sprintTasks = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?sprintId=${sprint.id}`,
      )
      .set("Cookie", owner.cookie);
    expect(sprintTasks.status).toBe(200);
    expect(sprintTasks.body.tasks.map((item: { id: string }) => item.id)).toContain(
      task.id,
    );

    const deleted = await request(app)
      .delete(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/sprints/${sprint.id}`,
      )
      .set("Cookie", owner.cookie);
    expect(deleted.status).toBe(409);
    expect(deleted.body.error.code).toBe("SPRINT_TASKS_EXIST");
  });
});

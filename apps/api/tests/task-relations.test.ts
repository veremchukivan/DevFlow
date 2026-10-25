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

describe("Task relation integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let viewer: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let sourceTask: Awaited<ReturnType<typeof createTestTask>>;
  let targetTask: Awaited<ReturnType<typeof createTestTask>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "relations-owner@devflow.io" });
    viewer = await createTestUser(app, {
      email: "relations-viewer@devflow.io",
    });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "task-relations",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "RELS",
      name: "Relations project",
    });
    sourceTask = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { title: "Source task" },
    );
    targetTask = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { title: "Target task" },
    );
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: viewer.email, role: "viewer" });
  });

  afterAll(async () => closeDbConnection());

  it("creates a directional blocking relation and shows the inverse on the target", async () => {
    const basePath = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${sourceTask.id}/relations`;
    const created = await request(app)
      .post(basePath)
      .set("Cookie", owner.cookie)
      .send({ relationType: "blocks", targetTaskId: targetTask.id });
    expect(created.status).toBe(201);

    const sourceRelations = await request(app)
      .get(basePath)
      .set("Cookie", owner.cookie);
    expect(sourceRelations.body.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relationType: "blocks",
          task: expect.objectContaining({ id: targetTask.id }),
        }),
      ]),
    );

    const targetRelations = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${targetTask.id}/relations`,
      )
      .set("Cookie", viewer.cookie);
    expect(targetRelations.body.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relationType: "is_blocked_by",
          task: expect.objectContaining({ id: sourceTask.id }),
        }),
      ]),
    );
  });

  it("prevents duplicate symmetric links and viewer mutations", async () => {
    const first = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${sourceTask.id}/relations`,
      )
      .set("Cookie", owner.cookie)
      .send({ relationType: "relates_to", targetTaskId: targetTask.id });
    expect(first.status).toBe(201);

    const duplicateFromOtherSide = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${targetTask.id}/relations`,
      )
      .set("Cookie", owner.cookie)
      .send({ relationType: "relates_to", targetTaskId: sourceTask.id });
    expect(duplicateFromOtherSide.status).toBe(409);
    expect(duplicateFromOtherSide.body.error.code).toBe("TASK_RELATION_EXISTS");

    const viewerCreate = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${sourceTask.id}/relations`,
      )
      .set("Cookie", viewer.cookie)
      .send({ relationType: "duplicates", targetTaskId: targetTask.id });
    expect(viewerCreate.status).toBe(403);
  });
});

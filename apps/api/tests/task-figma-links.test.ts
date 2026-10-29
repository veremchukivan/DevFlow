import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Task Figma links", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let taskId: string;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "task-figma-owner@devflow.io" });
    member = await createTestUser(app, { email: "task-figma-member@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, { slug: "task-figma-links" });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "TFIG",
      name: "Task Figma links",
    });
    const task = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", owner.cookie)
      .send({ title: "Build the linked screen" });
    expect(task.status).toBe(201);
    taskId = task.body.task.id;

    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.email, role: "member" });
  });

  afterAll(async () => closeDbConnection());

  it("lets an owner add a task-specific Figma link that members can read", async () => {
    const created = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${taskId}/figma-links`)
      .set("Cookie", owner.cookie)
      .send({
        name: "Task interaction prototype",
        url: "https://www.figma.com/proto/example/task-interaction",
      });

    expect(created.status).toBe(201);
    expect(created.body.link).toMatchObject({
      createdByUserId: owner.user.id,
      projectId: project.id,
      taskId,
      workspaceId: workspace.id,
    });

    const listed = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${taskId}/figma-links`)
      .set("Cookie", member.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.links).toHaveLength(1);
  });

  it("does not let a viewer change task-specific links", async () => {
    const viewer = await createTestUser(app, { email: "task-figma-viewer@devflow.io" });
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: viewer.email, role: "viewer" });

    const response = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${taskId}/figma-links`)
      .set("Cookie", viewer.cookie)
      .send({ name: "Another screen", url: "https://www.figma.com/design/example/screen" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("TASK_UPDATE_FORBIDDEN");
  });

  it("rejects a non-Figma URL", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${taskId}/figma-links`)
      .set("Cookie", owner.cookie)
      .send({ name: "Not Figma", url: "https://example.com/design" });

    expect(response.status).toBe(400);
  });
});

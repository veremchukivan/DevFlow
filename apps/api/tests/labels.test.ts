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

describe("Labels Integration Tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let outsiderWorkspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let task: Awaited<ReturnType<typeof createTestTask>>;
  let labelId: string;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "labels-owner@devflow.io" });
    outsider = await createTestUser(app, {
      email: "labels-outsider@devflow.io",
    });
    workspace = await createTestWorkspace(app, owner.cookie, {
      name: "Labels Workspace",
      slug: "labels-workspace",
    });
    outsiderWorkspace = await createTestWorkspace(app, outsider.cookie, {
      name: "Other Labels",
      slug: "other-labels",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      name: "Labels Project",
      key: "LAB",
    });
    task = await createTestTask(app, owner.cookie, workspace.id, project.id, {
      title: "Task with labels",
    });
  });

  afterAll(async () => closeDbConnection());

  it("creates labels and rejects duplicate names in a workspace", async () => {
    const create = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/labels`)
      .set("Cookie", owner.cookie)
      .send({ name: "Backend", color: "#2764ee" });
    expect(create.status).toBe(201);
    labelId = create.body.label.id;

    const duplicate = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/labels`)
      .set("Cookie", owner.cookie)
      .send({ name: "Backend", color: "#ff0000" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("LABEL_NAME_TAKEN");
  });

  it("assigns workspace labels to a task and returns them in the task list", async () => {
    const assign = await request(app)
      .put(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/labels`,
      )
      .set("Cookie", owner.cookie)
      .send({ labelIds: [labelId] });
    expect(assign.status).toBe(200);
    expect(assign.body.labels).toMatchObject([
      { id: labelId, name: "Backend" },
    ]);

    const list = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?labelId=${labelId}`,
      )
      .set("Cookie", owner.cookie);
    expect(list.status).toBe(200);
    expect(list.body.tasks).toHaveLength(1);
    expect(list.body.tasks[0].labels).toMatchObject([
      { id: labelId, name: "Backend" },
    ]);
  });

  it("rejects assigning a label from another workspace", async () => {
    const otherLabel = await request(app)
      .post(`/api/v1/workspaces/${outsiderWorkspace.id}/labels`)
      .set("Cookie", outsider.cookie)
      .send({ name: "Private", color: "#aa2266" });
    const assign = await request(app)
      .put(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/labels`,
      )
      .set("Cookie", owner.cookie)
      .send({ labelIds: [otherLabel.body.label.id] });
    expect(assign.status).toBe(400);
    expect(assign.body.error.code).toBe("TASK_LABEL_INVALID");
  });
});

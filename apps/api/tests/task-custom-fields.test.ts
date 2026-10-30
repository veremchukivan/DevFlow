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

describe("Task custom fields integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "custom-fields-owner@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "custom-fields",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "CFLD",
      name: "Custom fields project",
    });

    const settings = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/settings`)
      .set("Cookie", owner.cookie)
      .send({
        customFields: [
          { id: "stage", name: "Stage", options: ["Design", "Build"], type: "select" },
          { id: "points", name: "Points", options: [], type: "number" },
          { id: "note", name: "Note", options: [], type: "text" },
        ],
      });

    expect(settings.status).toBe(200);
  });

  afterAll(async () => closeDbConnection());

  it("creates a task with configured select, number, and text fields", async () => {
    const response = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", owner.cookie)
      .send({
        customFields: { note: "Ready for review", points: 5, stage: "Design" },
        title: "Task with custom fields",
      });

    expect(response.status).toBe(201);
    expect(response.body.task.customFields).toEqual({
      note: "Ready for review",
      points: 5,
      stage: "Design",
    });
  });

  it("rejects an unknown field and values outside configured select options", async () => {
    const unknownField = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", owner.cookie)
      .send({ customFields: { unknown: "value" }, title: "Unknown field" });

    expect(unknownField.status).toBe(400);
    expect(unknownField.body.error.code).toBe("TASK_CUSTOM_FIELD_UNKNOWN");

    const invalidOption = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
      .set("Cookie", owner.cookie)
      .send({ customFields: { stage: "Released" }, title: "Invalid select value" });

    expect(invalidOption.status).toBe(400);
    expect(invalidOption.body.error.code).toBe("TASK_CUSTOM_FIELD_INVALID");
  });

  it("filters tasks by configured select-field options", async () => {
    const response = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?customFieldId=stage&customFieldValue=Design`,
      )
      .set("Cookie", owner.cookie);

    expect(response.status).toBe(200);
    expect(response.body.tasks).toHaveLength(1);
    expect(response.body.tasks[0].customFields.stage).toBe("Design");

    const invalidOption = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks?customFieldId=stage&customFieldValue=Released`,
      )
      .set("Cookie", owner.cookie);

    expect(invalidOption.status).toBe(400);
    expect(invalidOption.body.error.code).toBe("TASK_CUSTOM_FIELD_FILTER_INVALID");
  });
});

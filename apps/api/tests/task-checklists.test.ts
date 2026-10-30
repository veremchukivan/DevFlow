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

describe("Task checklist integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let viewer: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let task: Awaited<ReturnType<typeof createTestTask>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "checklist-owner@devflow.io" });
    viewer = await createTestUser(app, {
      email: "checklist-viewer@devflow.io",
    });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "checklist-workspace",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "CHECK",
      name: "Checklist project",
    });
    task = await createTestTask(app, owner.cookie, workspace.id, project.id, {
      title: "Checklist task",
    });

    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: viewer.email, role: "viewer" });
  });

  afterAll(async () => {
    await closeDbConnection();
  });

  it("creates, lists, completes, and deletes checklist items", async () => {
    const basePath = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/checklist`;
    const createResponse = await request(app)
      .post(basePath)
      .set("Cookie", owner.cookie)
      .send({ content: "Write integration coverage" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.item.content).toBe("Write integration coverage");
    expect(createResponse.body.item.isCompleted).toBe(false);
    const itemId = createResponse.body.item.id;
    const activityPath = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/activity`;

    const listResponse = await request(app)
      .get(basePath)
      .set("Cookie", viewer.cookie);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.progress).toEqual({ completed: 0, total: 1 });

    const updateResponse = await request(app)
      .patch(`${basePath}/${itemId}`)
      .set("Cookie", owner.cookie)
      .send({ isCompleted: true });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.item.isCompleted).toBe(true);

    const activityAfterUpdate = await request(app)
      .get(activityPath)
      .set("Cookie", owner.cookie);
    expect(activityAfterUpdate.status).toBe(200);
    expect(activityAfterUpdate.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            content: "Write integration coverage",
            isCompleted: true,
          }),
          eventType: "task_checklist_item_updated",
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            content: "Write integration coverage",
          }),
          eventType: "task_checklist_item_added",
        }),
      ]),
    );

    const projectActivityResponse = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/activity`)
      .set("Cookie", viewer.cookie);
    expect(projectActivityResponse.status).toBe(200);
    expect(projectActivityResponse.body.pageInfo.total).toBeGreaterThanOrEqual(
      3,
    );
    expect(projectActivityResponse.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "task_checklist_item_updated",
          taskId: task.id,
          taskKey: "CHECK-1",
          taskTitle: "Checklist task",
        }),
      ]),
    );

    const preferencesPath = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/view-preferences`;
    const defaultPreferences = await request(app)
      .get(preferencesPath)
      .set("Cookie", viewer.cookie);
    expect(defaultPreferences.status).toBe(200);
    expect(defaultPreferences.body.preferences.activityLimit).toBe(1);
    expect(defaultPreferences.body.preferences).toMatchObject({
      taskCardAccent: "status",
      taskCardColor: "neutral",
      taskCardDensity: "comfortable",
    });

    const updatedPreferences = await request(app)
      .patch(preferencesPath)
      .set("Cookie", viewer.cookie)
      .send({
        activityLimit: 5,
        boardScrolling: "column",
        hideDoneTasks: true,
        taskCardAccent: "priority",
        taskCardColor: "violet",
        taskCardDensity: "compact",
      });
    expect(updatedPreferences.status).toBe(200);
    expect(updatedPreferences.body.preferences).toMatchObject({
      activityLimit: 5,
      boardScrolling: "column",
      hideDoneTasks: true,
      taskCardAccent: "priority",
      taskCardColor: "violet",
      taskCardDensity: "compact",
    });

    const ownerPreferences = await request(app)
      .get(preferencesPath)
      .set("Cookie", owner.cookie);
    expect(ownerPreferences.body.preferences.activityLimit).toBe(1);

    const completedListResponse = await request(app)
      .get(basePath)
      .set("Cookie", owner.cookie);
    expect(completedListResponse.body.progress).toEqual({
      completed: 1,
      total: 1,
    });

    const deleteResponse = await request(app)
      .delete(`${basePath}/${itemId}`)
      .set("Cookie", owner.cookie);
    expect(deleteResponse.status).toBe(204);

    const activityAfterDeletion = await request(app)
      .get(activityPath)
      .set("Cookie", owner.cookie);
    expect(activityAfterDeletion.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            content: "Write integration coverage",
          }),
          eventType: "task_checklist_item_removed",
        }),
      ]),
    );
  });

  it("forbids viewers from changing a task checklist", async () => {
    const response = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/checklist`,
      )
      .set("Cookie", viewer.cookie)
      .send({ content: "Viewer cannot add this" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("TASK_CHECKLIST_UPDATE_FORBIDDEN");
  });
});

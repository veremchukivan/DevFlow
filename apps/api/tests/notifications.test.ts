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

describe("Notification integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, {
      email: "notifications-owner@devflow.io",
    });
    member = await createTestUser(app, {
      email: "notifications-member@devflow.io",
    });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "notifications",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "NOTIF",
      name: "Notifications project",
    });
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.email, role: "member" });
  });

  afterAll(async () => closeDbConnection());

  it("notifies a member when they are assigned to a task", async () => {
    const task = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { assigneeUserId: member.user.id, title: "Assigned task" },
    );

    const listed = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", member.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.unreadCount).toBe(1);
    expect(listed.body.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: task.id,
          type: "task_assigned",
        }),
      ]),
    );

    const notificationId = listed.body.notifications[0].id;
    const marked = await request(app)
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set("Cookie", member.cookie);
    expect(marked.status).toBe(204);
  });
});

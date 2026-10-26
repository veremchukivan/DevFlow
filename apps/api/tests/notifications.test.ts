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
import { sendDeadlineNotifications } from "../src/modules/notifications/notifications.service.js";

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

  it("notifies an assignee about a new comment from another member", async () => {
    const task = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { assigneeUserId: member.user.id, title: "Comment notification task" },
    );
    const commented = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/comments`,
      )
      .set("Cookie", owner.cookie)
      .send({ body: "Please review this task." });
    expect(commented.status).toBe(201);

    const listed = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", member.cookie);
    expect(listed.body.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: task.id, type: "task_commented" }),
      ]),
    );
  });

  it("notifies an assignee when another member moves their task", async () => {
    const task = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { assigneeUserId: member.user.id, title: "Status notification task" },
    );
    const projectDetails = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
      .set("Cookie", owner.cookie);
    expect(projectDetails.status).toBe(200);
    const targetStatus = projectDetails.body.project.statuses.find(
      (status: { id: string; category: string }) =>
        status.category === "in_progress",
    );
    expect(targetStatus).toBeDefined();

    const updated = await request(app)
      .patch(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`,
      )
      .set("Cookie", owner.cookie)
      .set("If-Match", `\"${task.version}\"`)
      .send({ statusId: targetStatus.id });
    expect(updated.status).toBe(200);

    const activity = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/activity`,
      )
      .set("Cookie", owner.cookie);
    expect(activity.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ statusName: targetStatus.name }),
          eventType: "task_updated",
        }),
      ]),
    );

    const listed = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", member.cookie);
    expect(listed.body.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: task.id,
          type: "task_status_changed",
        }),
      ]),
    );
  });

  it("sends one due-today or overdue notification per assigned task", async () => {
    const dueToday = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      {
        assigneeUserId: member.user.id,
        dueDate: "2030-05-12",
        title: "Due today notification task",
      },
    );
    const overdue = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      {
        assigneeUserId: member.user.id,
        dueDate: "2030-05-11",
        title: "Overdue notification task",
      },
    );

    expect(await sendDeadlineNotifications("2030-05-12")).toBe(2);
    expect(await sendDeadlineNotifications("2030-05-12")).toBe(0);

    const listed = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", member.cookie);
    expect(listed.body.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: dueToday.id,
          type: "task_due_today",
        }),
        expect.objectContaining({
          taskId: overdue.id,
          type: "task_overdue",
        }),
      ]),
    );
  });

  it("marks every unread notification as read for the current user", async () => {
    const before = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", member.cookie);
    expect(before.body.unreadCount).toBeGreaterThan(0);

    const marked = await request(app)
      .post("/api/v1/notifications/read-all")
      .set("Cookie", member.cookie);
    expect(marked.status).toBe(204);

    const after = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", member.cookie);
    expect(after.body.unreadCount).toBe(0);
    expect(
      after.body.notifications.every(
        (item: { readAt: string | null }) => item.readAt,
      ),
    ).toBe(true);
  });
});

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

describe("Task time entry integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let viewer: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let task: Awaited<ReturnType<typeof createTestTask>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "time-owner@devflow.io" });
    viewer = await createTestUser(app, { email: "time-viewer@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "time-workspace",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "TIME",
      name: "Time project",
    });
    task = await createTestTask(app, owner.cookie, workspace.id, project.id, {
      title: "Track implementation time",
    });
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: viewer.email, role: "viewer" });
  });

  afterAll(async () => {
    await closeDbConnection();
  });

  it("logs manual time, runs a timer, and exposes a task summary", async () => {
    const taskPath = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`;
    const update = await request(app)
      .patch(taskPath)
      .set("Cookie", owner.cookie)
      .set("If-Match", '"1"')
      .send({ estimateMinutes: 120 });
    expect(update.status).toBe(200);
    expect(update.body.task.estimateMinutes).toBe(120);

    const basePath = `${taskPath}/time-entries`;
    const manual = await request(app)
      .post(basePath)
      .set("Cookie", owner.cookie)
      .send({
        description: "Implementation planning",
        durationMinutes: 30,
        startedAt: "2026-10-29T09:00:00.000Z",
      });
    expect(manual.status).toBe(201);
    expect(manual.body.entry.durationMinutes).toBe(30);
    expect(manual.body.entry.stoppedAt).toBe("2026-10-29T09:30:00.000Z");

    const started = await request(app)
      .post(`${basePath}/start`)
      .set("Cookie", owner.cookie)
      .send({});
    expect(started.status).toBe(201);
    expect(started.body.entry.stoppedAt).toBeNull();

    const duplicateStart = await request(app)
      .post(`${basePath}/start`)
      .set("Cookie", owner.cookie)
      .send({});
    expect(duplicateStart.status).toBe(409);
    expect(duplicateStart.body.error.code).toBe("TIMER_ALREADY_RUNNING");

    const stopped = await request(app)
      .post(`${basePath}/${started.body.entry.id}/stop`)
      .set("Cookie", owner.cookie)
      .send({});
    expect(stopped.status).toBe(200);
    expect(stopped.body.entry.durationMinutes).toBeGreaterThanOrEqual(1);

    const listed = await request(app).get(basePath).set("Cookie", viewer.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.entries).toHaveLength(2);
    expect(listed.body.summary.estimateMinutes).toBe(120);
    expect(listed.body.summary.loggedMinutes).toBeGreaterThanOrEqual(31);
    expect(listed.body.summary.remainingMinutes).toBeLessThanOrEqual(89);
    expect(listed.body.summary.activeEntry).toBeNull();

    const activity = await request(app)
      .get(`${taskPath}/activity`)
      .set("Cookie", owner.cookie);
    expect(activity.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "task_time_logged" }),
        expect.objectContaining({ eventType: "task_timer_started" }),
        expect.objectContaining({ eventType: "task_timer_stopped" }),
      ]),
    );
  });

  it("forbids viewers from creating a time entry", async () => {
    const response = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/time-entries`,
      )
      .set("Cookie", viewer.cookie)
      .send({
        durationMinutes: 10,
        startedAt: "2026-10-29T10:00:00.000Z",
      });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("TASK_TIME_UPDATE_FORBIDDEN");
  });
});

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { taskActivityEvents } from "../src/core/db/schema/task-activity-events.js";
import { tasks } from "../src/core/db/schema/tasks.js";
import {
  cleanupDatabase,
  createTestApp,
  createTestProject,
  createTestTask,
  createTestUser,
  createTestWorkspace,
  db,
  request
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Concurrency and Data Integrity Integration Tests", () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  it("safely generates sequential task numbers under concurrent creation in same project", async () => {
    const owner = await createTestUser(app);
    const workspace = await createTestWorkspace(app, owner.cookie);
    const project = await createTestProject(app, owner.cookie, workspace.id);

    // Fire 5 parallel task creation requests simultaneously
    const taskCount = 5;
    const taskPromises = Array.from({ length: taskCount }, (_, i) =>
      request(app)
        .post(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`
        )
        .set("Cookie", owner.cookie)
        .send({
          title: `Concurrent Task ${i + 1}`,
          priority: "medium"
        })
    );

    const responses = await Promise.all(taskPromises);

    // All requests should succeed with 201
    for (const res of responses) {
      expect(res.status).toBe(201);
      expect(res.body.task).toBeDefined();
    }

    // Numbers must be unique and from 1 to 5
    const numbers = responses.map((res) => res.body.task.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);

    // Verify all 5 activity events were created in the database
    const activityRows = await db
      .select()
      .from(taskActivityEvents)
      .where(eq(taskActivityEvents.projectId, project.id));

    expect(activityRows.length).toBe(taskCount);
    expect(activityRows.every((r) => r.eventType === "task_created")).toBe(true);
  });

  it("prevents duplicate pending invitations when invited simultaneously", async () => {
    const owner = await createTestUser(app);
    const workspace = await createTestWorkspace(app, owner.cookie);
    const inviteEmail = "concurrent-invitee@devflow.io";

    // Fire 2 concurrent invite requests for the exact same email
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/workspaces/${workspace.id}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: inviteEmail, role: "member" }),
      request(app)
        .post(`/api/v1/workspaces/${workspace.id}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: inviteEmail, role: "member" })
    ]);

    const statuses = [res1.status, res2.status].sort();
    // One must succeed (201) and one must be rejected (409 conflict)
    expect(statuses).toEqual([201, 409]);
  });

  it("prevents concurrent task updates from overwriting each other", async () => {
    const owner = await createTestUser(app);
    const workspace = await createTestWorkspace(app, owner.cookie);
    const project = await createTestProject(app, owner.cookie, workspace.id);
    const task = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id
    );
    const url = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`;

    const [firstUpdate, secondUpdate] = await Promise.all([
      request(app)
        .patch(url)
        .set("Cookie", owner.cookie)
        .set("If-Match", `"${task.version}"`)
        .send({ title: "First concurrent update" }),
      request(app)
        .patch(url)
        .set("Cookie", owner.cookie)
        .set("If-Match", `"${task.version}"`)
        .send({ title: "Second concurrent update" })
    ]);

    const statuses = [firstUpdate.status, secondUpdate.status].sort();
    expect(statuses).toEqual([200, 409]);

    const successfulUpdate = [firstUpdate, secondUpdate].find(
      (response) => response.status === 200
    );
    expect(successfulUpdate?.headers.etag).toBe('"2"');
    expect(successfulUpdate?.body.task.version).toBe(2);

    const taskUpdatedEvents = await db
      .select()
      .from(taskActivityEvents)
      .where(eq(taskActivityEvents.taskId, task.id));
    expect(
      taskUpdatedEvents.filter((event) => event.eventType === "task_updated")
    ).toHaveLength(1);
  });

  it("requires the current task ETag for a mutation", async () => {
    const owner = await createTestUser(app);
    const workspace = await createTestWorkspace(app, owner.cookie);
    const project = await createTestProject(app, owner.cookie, workspace.id);
    const task = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id
    );

    const response = await request(app)
      .patch(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`
      )
      .set("Cookie", owner.cookie)
      .send({ title: "Missing precondition" });

    expect(response.status).toBe(428);
    expect(response.body.error.code).toBe("TASK_VERSION_REQUIRED");
  });
});

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { projects } from "../src/core/db/schema/projects.js";
import { users } from "../src/core/db/schema/users.js";
import { workspaces } from "../src/core/db/schema/workspaces.js";
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

describe("Soft Delete Constraints Integration Tests", () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  it("allows reusing workspace slug after previous workspace is soft-deleted", async () => {
    const owner = await createTestUser(app);
    const workspace = await createTestWorkspace(app, owner.cookie, {
      name: "Acme Corp",
      slug: "acme-corp"
    });

    // Soft-delete the workspace in DB
    await db
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.id, workspace.id));

    // Create a new workspace with the identical slug
    const res = await request(app)
      .post("/api/v1/workspaces")
      .set("Cookie", owner.cookie)
      .send({
        name: "Acme Corp New",
        slug: "acme-corp"
      });

    expect(res.status).toBe(201);
    expect(res.body.workspace.slug).toBe("acme-corp");
    expect(res.body.workspace.id).not.toBe(workspace.id);
  });

  it("allows reusing project key in workspace after previous project is soft-deleted", async () => {
    const owner = await createTestUser(app);
    const workspace = await createTestWorkspace(app, owner.cookie);

    const project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "CORE",
      name: "Core Project"
    });

    // Soft-delete the project in DB
    await db
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, project.id));

    // Create a new project with the identical key in the same workspace
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects`)
      .set("Cookie", owner.cookie)
      .send({
        key: "CORE",
        name: "New Core Project"
      });

    expect(res.status).toBe(201);
    expect(res.body.project.key).toBe("CORE");
    expect(res.body.project.id).not.toBe(project.id);
  });

  it("allows re-registering email after previous account is soft-deleted", async () => {
    const email = "reusable-user@devflow.io";
    const initialUser = await createTestUser(app, {
      displayName: "Original User",
      email
    });

    // Soft-delete the user in DB
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.emailNormalized, email));

    // Re-register with the exact same email
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        displayName: "New Profile",
        email,
        password: "NewPassword123!"
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.displayName).toBe("New Profile");
  });

  it("restores an archived task with its current version", async () => {
    const owner = await createTestUser(app);
    const workspace = await createTestWorkspace(app, owner.cookie);
    const project = await createTestProject(app, owner.cookie, workspace.id);
    const task = await createTestTask(app, owner.cookie, workspace.id, project.id);
    const deleted = await request(app).delete(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`).set("Cookie", owner.cookie).set("If-Match", `"${task.version}"`);
    expect(deleted.status).toBe(204);
    const restored = await request(app).post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/restore`).set("Cookie", owner.cookie).set("If-Match", `"${task.version + 1}"`);
    expect(restored.status).toBe(204);

    const activity = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/activity`,
      )
      .set("Cookie", owner.cookie);

    expect(activity.status).toBe(200);
    expect(activity.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "task_restored" }),
      ]),
    );
  });
});

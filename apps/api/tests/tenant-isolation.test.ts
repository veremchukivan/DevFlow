import { beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  createTestApp,
  createTestProject,
  createTestTask,
  createTestUser,
  createTestWorkspace,
  request
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Tenant Isolation Integration Tests", () => {
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;
  let workspaceA: Awaited<ReturnType<typeof createTestWorkspace>>;
  let workspaceB: Awaited<ReturnType<typeof createTestWorkspace>>;
  let projectA: Awaited<ReturnType<typeof createTestProject>>;
  let taskA: Awaited<ReturnType<typeof createTestTask>>;

  beforeAll(async () => {
    await cleanupDatabase();

    // User A in Workspace A
    userA = await createTestUser(app, { email: "owner_a@devflow.io" });
    workspaceA = await createTestWorkspace(app, userA.cookie, {
      name: "Workspace Alpha",
      slug: "ws-alpha"
    });
    projectA = await createTestProject(app, userA.cookie, workspaceA.id, {
      key: "ALPHA",
      name: "Alpha Project"
    });
    taskA = await createTestTask(
      app,
      userA.cookie,
      workspaceA.id,
      projectA.id,
      { title: "Alpha Secret Task" }
    );

    // User B in Workspace B
    userB = await createTestUser(app, { email: "owner_b@devflow.io" });
    workspaceB = await createTestWorkspace(app, userB.cookie, {
      name: "Workspace Beta",
      slug: "ws-beta"
    });
  });

  it("prevents User B from accessing Workspace A details", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceA.id}`)
      .set("Cookie", userB.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from listing members of Workspace A", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceA.id}/members`)
      .set("Cookie", userB.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from adding members to Workspace A", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceA.id}/members`)
      .set("Cookie", userB.cookie)
      .send({ email: "intruder@devflow.io", role: "member" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from listing projects in Workspace A", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceA.id}/projects`)
      .set("Cookie", userB.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from creating a project in Workspace A", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceA.id}/projects`)
      .set("Cookie", userB.cookie)
      .send({ key: "HACK", name: "Infiltrated Project" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from reading Project A in Workspace A", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceA.id}/projects/${projectA.id}`)
      .set("Cookie", userB.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from listing tasks in Workspace A", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceA.id}/projects/${projectA.id}/tasks`)
      .set("Cookie", userB.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from creating a task in Workspace A", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceA.id}/projects/${projectA.id}/tasks`)
      .set("Cookie", userB.cookie)
      .send({ title: "Injected Task" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from reading Task A in Workspace A", async () => {
    const res = await request(app)
      .get(
        `/api/v1/workspaces/${workspaceA.id}/projects/${projectA.id}/tasks/${taskA.id}`
      )
      .set("Cookie", userB.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from modifying Task A in Workspace A", async () => {
    const res = await request(app)
      .patch(
        `/api/v1/workspaces/${workspaceA.id}/projects/${projectA.id}/tasks/${taskA.id}`
      )
      .set("Cookie", userB.cookie)
      .send({ title: "Compromised Title" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from deleting Task A in Workspace A", async () => {
    const res = await request(app)
      .delete(
        `/api/v1/workspaces/${workspaceA.id}/projects/${projectA.id}/tasks/${taskA.id}`
      )
      .set("Cookie", userB.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from viewing invitations of Workspace A", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceA.id}/invitations`)
      .set("Cookie", userB.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("prevents User B from creating invitations for Workspace A", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceA.id}/invitations`)
      .set("Cookie", userB.cookie)
      .send({ email: "guest@devflow.io", role: "member" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });
});


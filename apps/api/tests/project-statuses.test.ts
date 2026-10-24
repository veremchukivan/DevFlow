import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestProject,
  createTestTask,
  createTestUser,
  createTestWorkspace,
  request
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Project status integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "status-owner@devflow.io" });
    member = await createTestUser(app, { email: "status-member@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, { name: "Status Workspace", slug: "status-workspace" });
    await request(app).post(`/api/v1/workspaces/${workspace.id}/members`).set("Cookie", owner.cookie).send({ email: member.email, role: "member" });
    project = await createTestProject(app, owner.cookie, workspace.id, { key: "STAT", name: "Status Project" });
  });

  afterAll(async () => closeDbConnection());

  it("creates and updates a project status", async () => {
    const created = await request(app).post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/statuses`).set("Cookie", owner.cookie).send({ name: "Review", category: "in_progress", color: "#7c3aed" });
    expect(created.status).toBe(201);
    const status = created.body.project.statuses.find((item: { name: string }) => item.name === "Review");
    expect(status).toBeDefined();

    const updated = await request(app).patch(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/statuses/${status.id}`).set("Cookie", owner.cookie).send({ name: "Code review", color: "#6d28d9" });
    expect(updated.status).toBe(200);
    expect(updated.body.project.statuses.find((item: { id: string }) => item.id === status.id).name).toBe("Code review");
  });

  it("forbids members from managing statuses", async () => {
    const res = await request(app).post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/statuses`).set("Cookie", member.cookie).send({ name: "Blocked", category: "todo", color: "#64748b" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PROJECT_UPDATE_FORBIDDEN");
  });

  it("does not delete a status that contains tasks", async () => {
    const status = project.statuses[0];
    await createTestTask(app, owner.cookie, workspace.id, project.id, { statusId: status.id });
    const res = await request(app).delete(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/statuses/${status.id}`).set("Cookie", owner.cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PROJECT_STATUS_TASKS_EXIST");
  });
});

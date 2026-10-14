import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  request
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Workspaces and Projects CRUD Integration Tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let viewer: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let secondWorkspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    await cleanupDatabase();

    owner = await createTestUser(app, { email: "crud_owner@devflow.io" });
    admin = await createTestUser(app, { email: "crud_admin@devflow.io" });
    member = await createTestUser(app, { email: "crud_member@devflow.io" });
    viewer = await createTestUser(app, { email: "crud_viewer@devflow.io" });

    workspace = await createTestWorkspace(app, owner.cookie, {
      name: "Original Workspace",
      slug: "orig-ws"
    });

    secondWorkspace = await createTestWorkspace(app, owner.cookie, {
      name: "Second Workspace",
      slug: "second-ws"
    });

    // Add members
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: admin.email, role: "admin" });

    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.email, role: "member" });

    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: viewer.email, role: "viewer" });

    project = await createTestProject(app, owner.cookie, workspace.id, {
      description: "Original Description",
      key: "ORIG",
      name: "Original Project"
    });
  });

  afterAll(async () => {
    await closeDbConnection();
  });

  describe("Workspace PATCH /api/v1/workspaces/:workspaceId", () => {
    it("forbids regular member from updating workspace", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set("Cookie", member.cookie)
        .send({ name: "Member Hacked WS" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WORKSPACE_UPDATE_FORBIDDEN");
    });

    it("forbids viewer from updating workspace", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set("Cookie", viewer.cookie)
        .send({ name: "Viewer Hacked WS" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WORKSPACE_UPDATE_FORBIDDEN");
    });

    it("rejects duplicate slug already in use by another workspace", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set("Cookie", owner.cookie)
        .send({ slug: "second-ws" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("WORKSPACE_SLUG_TAKEN");
    });

    it("allows admin to update workspace name", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set("Cookie", admin.cookie)
        .send({ name: "Renamed by Admin" });

      expect(res.status).toBe(200);
      expect(res.body.workspace.name).toBe("Renamed by Admin");
    });

    it("allows owner to update workspace slug and name", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set("Cookie", owner.cookie)
        .send({ name: "DevFlow Core", slug: "devflow-core" });

      expect(res.status).toBe(200);
      expect(res.body.workspace.name).toBe("DevFlow Core");
      expect(res.body.workspace.slug).toBe("devflow-core");
    });
  });

  describe("Project PATCH /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    it("forbids regular member from updating project", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
        .set("Cookie", member.cookie)
        .send({ name: "Hacked Project" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("PROJECT_UPDATE_FORBIDDEN");
    });

    it("allows admin to update project name, key, and description", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
        .set("Cookie", admin.cookie)
        .send({
          description: "Updated by Admin",
          key: "ADM",
          name: "Admin Managed Project"
        });

      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe("Admin Managed Project");
      expect(res.body.project.key).toBe("ADM");
      expect(res.body.project.description).toBe("Updated by Admin");
      expect(res.body.project.statuses.length).toBeGreaterThan(0);
    });

    it("rejects updating project key to an existing project key in same workspace", async () => {
      // Create another project in the same workspace
      await createTestProject(app, owner.cookie, workspace.id, {
        key: "OTHER",
        name: "Other Project"
      });

      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
        .set("Cookie", owner.cookie)
        .send({ key: "OTHER" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PROJECT_KEY_TAKEN");
    });
  });

  describe("Project DELETE /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    let projectToDelete: Awaited<ReturnType<typeof createTestProject>>;

    beforeAll(async () => {
      projectToDelete = await createTestProject(app, owner.cookie, workspace.id, {
        key: "DEL",
        name: "Project To Delete"
      });
    });

    it("forbids member from deleting project", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/projects/${projectToDelete.id}`)
        .set("Cookie", member.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("PROJECT_DELETE_FORBIDDEN");
    });

    it("allows admin to soft delete project", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/projects/${projectToDelete.id}`)
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(204);

      // Verify project is no longer found
      const getRes = await request(app)
        .get(`/api/v1/workspaces/${workspace.id}/projects/${projectToDelete.id}`)
        .set("Cookie", owner.cookie);

      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe("PROJECT_NOT_FOUND");
    });

    it("allows reusing key of a soft deleted project", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", owner.cookie)
        .send({ key: "DEL", name: "New Project With Reused Key" });

      expect(res.status).toBe(201);
      expect(res.body.project.key).toBe("DEL");
    });
  });

  describe("Workspace DELETE /api/v1/workspaces/:workspaceId", () => {
    let wsToDelete: Awaited<ReturnType<typeof createTestWorkspace>>;

    beforeAll(async () => {
      wsToDelete = await createTestWorkspace(app, owner.cookie, {
        name: "Temporary WS",
        slug: "temp-ws"
      });

      await request(app)
        .post(`/api/v1/workspaces/${wsToDelete.id}/members`)
        .set("Cookie", owner.cookie)
        .send({ email: admin.email, role: "admin" });
    });

    it("forbids admin from deleting workspace", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${wsToDelete.id}`)
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WORKSPACE_DELETE_FORBIDDEN");
    });

    it("allows owner to soft delete workspace", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${wsToDelete.id}`)
        .set("Cookie", owner.cookie);

      expect(res.status).toBe(204);

      // Verify workspace is no longer accessible
      const getRes = await request(app)
        .get(`/api/v1/workspaces/${wsToDelete.id}`)
        .set("Cookie", owner.cookie);

      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    });

    it("allows reusing slug of a soft deleted workspace", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Cookie", owner.cookie)
        .send({ name: "New Reused WS", slug: "temp-ws" });

      expect(res.status).toBe(201);
      expect(res.body.workspace.slug).toBe("temp-ws");
    });
  });
});

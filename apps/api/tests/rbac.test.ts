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

describe("RBAC Permissions Integration Tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let viewer: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let task: Awaited<ReturnType<typeof createTestTask>>;

  beforeAll(async () => {
    await cleanupDatabase();

    // 1. Create owner and workspace
    owner = await createTestUser(app, { email: "owner_rbac@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, {
      name: "RBAC Workspace",
      slug: "rbac-ws"
    });

    // 2. Create users for roles
    admin = await createTestUser(app, { email: "admin_rbac@devflow.io" });
    member = await createTestUser(app, { email: "member_rbac@devflow.io" });
    viewer = await createTestUser(app, { email: "viewer_rbac@devflow.io" });

    // 3. Owner adds them to workspace with respective roles
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

    // 4. Create base project and task by owner
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "RBAC",
      name: "RBAC Project"
    });

    task = await createTestTask(app, owner.cookie, workspace.id, project.id, {
      title: "Initial Task"
    });
  });

  describe("Project creation permissions", () => {
    it("allows admin to create a project", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", admin.cookie)
        .send({ key: "ADM", name: "Admin Project" });

      expect(res.status).toBe(201);
      expect(res.body.project.key).toBe("ADM");
    });

    it("forbids member from creating a project", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", member.cookie)
        .send({ key: "MEM", name: "Member Project" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("PROJECT_CREATE_FORBIDDEN");
    });

    it("forbids viewer from creating a project", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set("Cookie", viewer.cookie)
        .send({ key: "VIW", name: "Viewer Project" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("PROJECT_CREATE_FORBIDDEN");
    });
  });

  describe("Task creation and modification permissions", () => {
    it("allows member to create a task", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
        .set("Cookie", member.cookie)
        .send({ title: "Task by member" });

      expect(res.status).toBe(201);
      expect(res.body.task.title).toBe("Task by member");
    });

    it("allows member to update a task", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`
        )
        .set("Cookie", member.cookie)
        .send({ title: "Updated by member" });

      expect(res.status).toBe(200);
      expect(res.body.task.title).toBe("Updated by member");
    });

    it("forbids member from deleting a task", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`
        )
        .set("Cookie", member.cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("TASK_DELETE_FORBIDDEN");
    });

    it("forbids viewer from creating a task", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks`)
        .set("Cookie", viewer.cookie)
        .send({ title: "Task by viewer" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("TASK_CREATE_FORBIDDEN");
    });

    it("forbids viewer from updating a task", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`
        )
        .set("Cookie", viewer.cookie)
        .send({ title: "Hacked by viewer" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("TASK_UPDATE_FORBIDDEN");
    });

    it("allows admin to delete a task", async () => {
      const taskToDelete = await createTestTask(
        app,
        owner.cookie,
        workspace.id,
        project.id,
        { title: "Task to delete" }
      );

      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${taskToDelete.id}`
        )
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(204);
    });
  });

  describe("Task comment permissions and author override", () => {
    it("allows author to update comment, but forbids another member", async () => {
      // Member creates comment
      const createRes = await request(app)
        .post(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/comments`
        )
        .set("Cookie", member.cookie)
        .send({ body: "Original author comment" });

      expect(createRes.status).toBe(201);
      const commentId = createRes.body.comment.id;

      // Another member attempts to edit comment -> 403
      const strangerMember = await createTestUser(app, {
        email: "stranger@devflow.io"
      });
      await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .set("Cookie", owner.cookie)
        .send({ email: strangerMember.email, role: "member" });

      const strangerEditRes = await request(app)
        .patch(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/comments/${commentId}`
        )
        .set("Cookie", strangerMember.cookie)
        .send({ body: "Tampered comment" });

      expect(strangerEditRes.status).toBe(403);
      expect(strangerEditRes.body.error.code).toBe("TASK_COMMENT_UPDATE_FORBIDDEN");

      // Original author edits comment -> 200
      const authorEditRes = await request(app)
        .patch(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/comments/${commentId}`
        )
        .set("Cookie", member.cookie)
        .send({ body: "Updated by author" });

      expect(authorEditRes.status).toBe(200);
      expect(authorEditRes.body.comment.body).toBe("Updated by author");

      // Admin can delete comment even if not author -> 204
      const adminDeleteRes = await request(app)
        .delete(
          `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/comments/${commentId}`
        )
        .set("Cookie", admin.cookie);

      expect(adminDeleteRes.status).toBe(204);
    });
  });
});

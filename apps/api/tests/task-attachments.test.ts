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

describe("Task attachment integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let viewer: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let task: Awaited<ReturnType<typeof createTestTask>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, {
      email: "attachments-owner@devflow.io",
    });
    viewer = await createTestUser(app, {
      email: "attachments-viewer@devflow.io",
    });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "task-attachments",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "FILES",
      name: "Attachments project",
    });
    task = await createTestTask(app, owner.cookie, workspace.id, project.id, {
      title: "Task with attachments",
    });
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: viewer.email, role: "viewer" });
  });

  afterAll(async () => closeDbConnection());

  it("uploads, lists, downloads, and removes a protected attachment", async () => {
    const basePath = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/attachments`;
    const uploaded = await request(app)
      .post(basePath)
      .set("Cookie", owner.cookie)
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        contentType: "image/png",
        filename: "plan.png",
      });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.attachment.originalFilename).toBe("plan.png");
    expect(uploaded.body.attachment.mimeType).toBe("image/png");
    const attachmentId = uploaded.body.attachment.id;

    const listed = await request(app)
      .get(basePath)
      .set("Cookie", viewer.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.attachments).toHaveLength(1);

    const downloaded = await request(app)
      .get(`${basePath}/${attachmentId}/download`)
      .set("Cookie", viewer.cookie);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toContain("image/png");

    const viewerDelete = await request(app)
      .delete(`${basePath}/${attachmentId}`)
      .set("Cookie", viewer.cookie);
    expect(viewerDelete.status).toBe(403);

    const removed = await request(app)
      .delete(`${basePath}/${attachmentId}`)
      .set("Cookie", owner.cookie);
    expect(removed.status).toBe(204);
  });
});

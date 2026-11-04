import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Project Figma links", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "figma-links-owner@devflow.io" });
    member = await createTestUser(app, { email: "figma-links-member@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "figma-links",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "FIGMA",
      name: "Figma links",
    });

    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.email, role: "member" });
  });

  afterAll(async () => closeDbConnection());

  it("lets an owner add a shared Figma link that members can read", async () => {
    const created = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/figma-links`,
      )
      .set("Cookie", owner.cookie)
      .send({
        name: "Product design",
        url: "https://www.figma.com/design/example/Product-design",
      });

    expect(created.status).toBe(201);
    expect(created.body.link).toMatchObject({
      createdByUserId: owner.user.id,
      name: "Product design",
      projectId: project.id,
      workspaceId: workspace.id,
    });

    const listed = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/figma-links`,
      )
      .set("Cookie", member.cookie);

    expect(listed.status).toBe(200);
    expect(listed.body.links).toHaveLength(1);
    expect(listed.body.links[0].id).toBe(created.body.link.id);
  });

  it("prevents a member from changing shared Figma links", async () => {
    const created = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/figma-links`,
      )
      .set("Cookie", owner.cookie)
      .send({
        name: "Prototype",
        url: "https://www.figma.com/proto/example/Prototype",
      });

    const response = await request(app)
      .delete(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/figma-links/${created.body.link.id}`,
      )
      .set("Cookie", member.cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PROJECT_UPDATE_FORBIDDEN");
  });

  it("rejects links that do not point to Figma", async () => {
    const response = await request(app)
      .post(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/figma-links`,
      )
      .set("Cookie", owner.cookie)
      .send({ name: "Not Figma", url: "https://example.com/design" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

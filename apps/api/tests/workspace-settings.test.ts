import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestUser,
  createTestWorkspace,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Workspace settings integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "settings-owner@devflow.io" });
    admin = await createTestUser(app, { email: "settings-admin@devflow.io" });
    member = await createTestUser(app, { email: "settings-member@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "workspace-settings",
    });

    for (const user of [admin, member]) {
      const response = await request(app)
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .set("Cookie", owner.cookie)
        .send({
          email: user.email,
          role: user === admin ? "admin" : "member",
        });
      expect(response.status).toBe(201);
    }
  });

  afterAll(async () => closeDbConnection());

  it("allows admins to configure workspace fields, types, and features", async () => {
    const response = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/settings`)
      .set("Cookie", admin.cookie)
      .send({
        customFields: [
          {
            id: "customer-impact",
            name: "Customer impact",
            options: ["Low", "High"],
            type: "select",
          },
        ],
        enabledTaskTypes: ["task", "bug"],
        features: {
          attachments: true,
          automation: true,
          sprints: false,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.settings).toMatchObject({
      customFields: [
        expect.objectContaining({ id: "customer-impact", name: "Customer impact" }),
      ],
      enabledTaskTypes: ["task", "bug"],
      features: { attachments: true, automation: true, sprints: false },
    });

    const stored = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/settings`)
      .set("Cookie", member.cookie);
    expect(stored.status).toBe(200);
    expect(stored.body.settings.features.sprints).toBe(false);
  });

  it("prevents members from changing workspace-wide settings", async () => {
    const response = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/settings`)
      .set("Cookie", member.cookie)
      .send({ defaultAssigneeUserId: member.user.id });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("WORKSPACE_UPDATE_FORBIDDEN");
  });

  it("keeps saved filters personal while preserving their board criteria", async () => {
    const created = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/settings/filters`)
      .set("Cookie", owner.cookie)
      .send({
        criteria: {
          assigneeUserId: "none",
          due: "overdue",
          priority: "urgent",
        },
        name: "Urgent unassigned overdue work",
      });

    expect(created.status).toBe(201);
    expect(created.body.filter.criteria).toEqual({
      assigneeUserId: "none",
      due: "overdue",
      priority: "urgent",
    });

    const ownerFilters = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/settings/filters`)
      .set("Cookie", owner.cookie);
    expect(ownerFilters.body.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.filter.id }),
      ]),
    );

    const memberFilters = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/settings/filters`)
      .set("Cookie", member.cookie);
    expect(memberFilters.status).toBe(200);
    expect(memberFilters.body.filters).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.filter.id }),
      ]),
    );

    const deletion = await request(app)
      .delete(
        `/api/v1/workspaces/${workspace.id}/settings/filters/${created.body.filter.id}`,
      )
      .set("Cookie", member.cookie);
    expect(deletion.status).toBe(404);
  });
});

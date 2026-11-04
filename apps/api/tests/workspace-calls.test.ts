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

describe("Workspace calls integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let callId: string;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "calls-owner@devflow.test" });
    member = await createTestUser(app, { email: "calls-member@devflow.test" });
    outsider = await createTestUser(app, { email: "calls-outsider@devflow.test" });
    workspace = await createTestWorkspace(app, owner.cookie, { slug: "calls-workspace" });
    project = await createTestProject(app, owner.cookie, workspace.id, { key: "CALL", name: "Calls project" });
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.email, role: "member" });
  });

  afterAll(async () => closeDbConnection());

  it("creates, lists, responds to, and updates a workspace call", async () => {
    const created = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/calls`)
      .set("Cookie", owner.cookie)
      .send({
        attendeeUserIds: [member.user.id],
        description: "Decide what to ship next.",
        endsAt: "2026-11-05T10:30:00.000Z",
        meetingUrl: "https://meet.example.test/devflow",
        projectId: project.id,
        startsAt: "2026-11-05T10:00:00.000Z",
        timezone: "Europe/Bratislava",
        title: "Sprint planning",
      });

    expect(created.status).toBe(201);
    expect(created.body.call.title).toBe("Sprint planning");
    expect(created.body.call.attendees.map((attendee: { userId: string }) => attendee.userId)).toEqual(
      expect.arrayContaining([owner.user.id, member.user.id]),
    );
    callId = created.body.call.id;

    const listed = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/calls?from=2026-11-01T00:00:00.000Z&to=2026-11-30T23:59:59.999Z`)
      .set("Cookie", owner.cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.calls).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: callId })]),
    );

    const accepted = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/calls/${callId}/attendance`)
      .set("Cookie", member.cookie)
      .send({ responseStatus: "accepted" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.call.attendees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ responseStatus: "accepted", userId: member.user.id }),
      ]),
    );

    const updated = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/calls/${callId}`)
      .set("Cookie", owner.cookie)
      .send({ title: "Sprint planning · final" });
    expect(updated.status).toBe(200);
    expect(updated.body.call.title).toBe("Sprint planning · final");
  });

  it("isolates calls from users outside the workspace", async () => {
    const response = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/calls`)
      .set("Cookie", outsider.cookie);
    expect(response.status).toBe(404);
  });

  it("does not let a member delete a call created by another user", async () => {
    const response = await request(app)
      .delete(`/api/v1/workspaces/${workspace.id}/calls/${callId}`)
      .set("Cookie", member.cookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CALL_DELETE_FORBIDDEN");
  });
});

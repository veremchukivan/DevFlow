import { beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  createTestApp,
  createTestUser,
  createTestWorkspace,
  request
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Workspace Invitations Integration Tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let invitee: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;

  beforeAll(async () => {
    await cleanupDatabase();

    owner = await createTestUser(app, { email: "owner_inv@devflow.io" });
    member = await createTestUser(app, { email: "member_inv@devflow.io" });
    invitee = await createTestUser(app, { email: "newcomer_inv@devflow.io" });

    workspace = await createTestWorkspace(app, owner.cookie, {
      name: "Invitation Workspace",
      slug: "inv-ws"
    });

    // Add member
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.email, role: "member" });
  });

  it("allows owner to issue an invitation and returns secure token", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", owner.cookie)
      .send({
        email: invitee.email,
        role: "admin"
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.invitation).toMatchObject({
      email: invitee.email,
      role: "admin",
      workspaceId: workspace.id
    });
  });

  it("forbids regular member from creating an invitation", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", member.cookie)
      .send({
        email: "random@devflow.io",
        role: "member"
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("WORKSPACE_INVITATION_FORBIDDEN");
  });

  it("rejects duplicate pending invitation for the same email", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", owner.cookie)
      .send({
        email: invitee.email,
        role: "viewer"
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("WORKSPACE_INVITATION_ALREADY_EXISTS");
  });

  it("lists pending invitations with inviter details", async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", owner.cookie);

    expect(res.status).toBe(200);
    expect(res.body.invitations).toHaveLength(1);
    expect(res.body.invitations[0].email).toBe(invitee.email);
    expect(res.body.invitations[0].invitedBy.email).toBe(owner.email);
  });

  it("allows public inspection of an invitation via raw token", async () => {
    // Get existing invitation token
    const listRes = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", owner.cookie);

    const invId = listRes.body.invitations[0].id;

    // Resend to obtain fresh token
    const resendRes = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations/${invId}/resend`)
      .set("Cookie", owner.cookie);

    expect(resendRes.status).toBe(200);
    const token = resendRes.body.token;

    // Public lookup without authentication
    const publicRes = await request(app).get(`/api/v1/invitations/${token}`);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.invitation).toMatchObject({
      email: invitee.email,
      isAccepted: false,
      isExpired: false,
      isRejected: false,
      role: "admin",
      workspaceName: workspace.name
    });
  });

  it("allows invited user to accept invitation and become active member", async () => {
    // Get fresh token via resend
    const listRes = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", owner.cookie);

    const invId = listRes.body.invitations[0].id;

    const resendRes = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations/${invId}/resend`)
      .set("Cookie", owner.cookie);

    const token = resendRes.body.token;

    // Accept invitation with invitee's session cookie
    const acceptRes = await request(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set("Cookie", invitee.cookie);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body).toMatchObject({
      role: "admin",
      workspaceId: workspace.id
    });

    // Verify invitee is now an active member
    const membersRes = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", invitee.cookie);

    expect(membersRes.status).toBe(200);
    const memberEmails = membersRes.body.members.map(
      (m: { user: { email: string } }) => m.user.email
    );
    expect(memberEmails).toContain(invitee.email);

    // Re-accepting should fail with 409
    const secondAcceptRes = await request(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set("Cookie", invitee.cookie);

    expect(secondAcceptRes.status).toBe(409);
    expect(secondAcceptRes.body.error.code).toBe(
      "WORKSPACE_INVITATION_ALREADY_ACCEPTED"
    );
  });

  it("allows declining an invitation", async () => {
    // Issue invitation to another email
    const createRes = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", owner.cookie)
      .send({
        email: "decline_me@devflow.io",
        role: "viewer"
      });

    const token = createRes.body.token;

    const declineRes = await request(app).post(
      `/api/v1/invitations/${token}/decline`
    );

    expect(declineRes.status).toBe(200);
    expect(declineRes.body.status).toBe("declined");

    // Public lookup confirms rejected
    const publicRes = await request(app).get(`/api/v1/invitations/${token}`);
    expect(publicRes.body.invitation.isRejected).toBe(true);
  });
});


import { describe, expect, it } from "vitest";

import {
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
  buildWorkspaceInvitationEmail
} from "../src/core/email/mailer.js";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

describe("email messages", () => {
  it("creates an acceptance link", () => {
    const token = "secure-invitation-token";
    const message = buildWorkspaceInvitationEmail({
      email: "invitee@example.com",
      expiresAt: new Date("2026-10-20T12:00:00.000Z"),
      inviterDisplayName: "Alice",
      role: "member",
      token,
      workspaceName: "Acme"
    });

    expect(message).toEqual({
      subject: "You're invited to Acme on DevFlow",
      text: expect.stringContaining(
        `${webOrigin}/invitations/${token}`
      ),
      to: "invitee@example.com"
    });
  });

  it("creates a verification link", () => {
    const token = "secure-email-verification-token";
    const message = buildEmailVerificationEmail({
      displayName: "Alice",
      email: "alice@example.com",
      token
    });

    expect(message).toEqual({
      subject: "Verify your DevFlow email address",
      text: expect.stringContaining(
        `${webOrigin}/verify-email/${token}`
      ),
      to: "alice@example.com"
    });
  });

  it("creates a password reset link", () => {
    const token = "secure-password-reset-token";
    const message = buildPasswordResetEmail({
      displayName: "Alice",
      email: "alice@example.com",
      token
    });

    expect(message).toEqual({
      subject: "Reset your DevFlow password",
      text: expect.stringContaining(
        `${webOrigin}/reset-password/${token}`
      ),
      to: "alice@example.com"
    });
  });
});

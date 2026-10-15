import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../../config/env.js";

type WorkspaceInvitationEmailInput = {
  email: string;
  expiresAt: Date;
  inviterDisplayName: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  token: string;
  workspaceName: string;
};

type EmailVerificationEmailInput = {
  displayName: string;
  email: string;
  token: string;
};

let transporter: Transporter | undefined;

export async function sendWorkspaceInvitationEmail(
  input: WorkspaceInvitationEmailInput
) {
  if (env.NODE_ENV === "test") {
    return;
  }

  const configuredTransporter = getTransporter();

  if (!configuredTransporter || !env.SMTP_FROM) {
    return;
  }

  const message = buildWorkspaceInvitationEmail(input);

  await configuredTransporter.sendMail({
    from: env.SMTP_FROM,
    ...message
  });
}

export function buildWorkspaceInvitationEmail(
  input: WorkspaceInvitationEmailInput
) {
  const invitationUrl = new URL(
    `/invitations/${encodeURIComponent(input.token)}`,
    env.WEB_ORIGIN
  ).toString();
  const inviter = input.inviterDisplayName ?? "A DevFlow workspace member";
  const expiresAt = input.expiresAt.toISOString();

  return {
    to: input.email,
    subject: `You're invited to ${input.workspaceName} on DevFlow`,
    text: [
      `${inviter} invited you to join ${input.workspaceName} as a ${input.role}.`,
      "",
      `Accept the invitation: ${invitationUrl}`,
      "",
      `This invitation expires at ${expiresAt}.`
    ].join("\n")
  };
}

export async function sendEmailVerificationEmail(
  input: EmailVerificationEmailInput
) {
  if (env.NODE_ENV === "test") {
    return;
  }

  const configuredTransporter = getTransporter();

  if (!configuredTransporter || !env.SMTP_FROM) {
    return;
  }

  await configuredTransporter.sendMail({
    from: env.SMTP_FROM,
    ...buildEmailVerificationEmail(input)
  });
}

export function buildEmailVerificationEmail(input: EmailVerificationEmailInput) {
  const verificationUrl = new URL(
    `/verify-email/${encodeURIComponent(input.token)}`,
    env.WEB_ORIGIN
  ).toString();

  return {
    to: input.email,
    subject: "Verify your DevFlow email address",
    text: [
      `Hi ${input.displayName},`,
      "",
      `Verify your email address: ${verificationUrl}`,
      "",
      `This link expires in ${env.EMAIL_VERIFICATION_TTL_HOURS} hours.`
    ].join("\n")
  };
}

function getTransporter() {
  if (!env.SMTP_HOST) {
    return undefined;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      auth: env.SMTP_USER
        ? {
            pass: env.SMTP_PASSWORD,
            user: env.SMTP_USER
          }
        : undefined,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE
    });
  }

  return transporter;
}

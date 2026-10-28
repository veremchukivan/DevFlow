import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type {
  ChangePasswordRequest,
  ChangeEmailRequest,
  CreateApiTokenRequest,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from "@devflow/shared";

import { env } from "../../config/env.js";
import type { User } from "../../core/db/schema/users.js";
import { AppError } from "../../core/errors/app-error.js";
import { deleteStoredImage, saveImage } from "../../core/uploads/images.js";
import {
  createSession,
  createApiToken,
  createUser,
  createUserWithDefaultWorkspace,
  consumeEmailVerificationToken,
  consumeEmailChangeToken,
  consumePasswordResetToken,
  deleteOtherSessionsForUser,
  deleteAccountAndPersonalWorkspaces,
  deleteSessionForUser,
  deleteSessionByTokenHash,
  ensureDefaultWorkspaceForUser,
  findUserPasswordById,
  findSessionUserByTokenHash,
  findUserByEmailNormalized,
  findUserByApiTokenHash,
  findUserAvatarById,
  getAccountDataExport,
  listActiveSessionsForUser,
  listApiTokens,
  replaceEmailVerificationToken,
  replaceEmailChangeToken,
  replacePasswordResetToken,
  revokeApiToken,
  touchSession,
  updatePasswordAndDeleteSessions,
  updateUserDisplayName,
  updateUserAvatar,
  type SessionUser,
} from "./auth.repository.js";

const sessionTokenBytes = 32;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash("devflow-dummy-timing-defense-password", {
      type: argon2.argon2id,
    });
  }
  return dummyHashPromise;
}

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type AuthResult = {
  emailVerificationToken?: string;
  sessionExpiresAt: Date;
  sessionToken: string;
  user: SessionUser;
};

export async function register(
  input: RegisterRequest,
  meta: RequestMeta,
): Promise<AuthResult> {
  const emailNormalized = normalizeEmail(input.email);
  const existingUser = await findUserByEmailNormalized(emailNormalized);

  if (existingUser) {
    throw new AppError(
      409,
      "EMAIL_ALREADY_REGISTERED",
      "A user with this email already exists",
    );
  }

  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });

  const user = await createRegisteredUser({
    displayName: input.displayName,
    email: input.email,
    emailNormalized,
    passwordHash,
  });

  const result = await createAuthResult(user, meta);

  return {
    ...result,
    emailVerificationToken:
      (await issueEmailVerificationToken(user)) ?? undefined,
  };
}

export async function login(
  input: LoginRequest,
  meta: RequestMeta,
): Promise<AuthResult> {
  const user = await findUserByEmailNormalized(normalizeEmail(input.email));
  const dummyHash = await getDummyHash();

  const hashToVerify = user?.passwordHash ?? dummyHash;
  const passwordMatches = await argon2.verify(hashToVerify, input.password);

  if (!user?.passwordHash || !passwordMatches) {
    throw invalidCredentialsError();
  }

  await ensureDefaultWorkspaceForUser({
    displayName: user.displayName,
    userId: user.id,
    workspaceSlug: `personal-${randomBytes(6).toString("hex")}`,
  });

  return createAuthResult(user, meta);
}

export async function getCurrentUser(sessionToken: string) {
  const session = await findSessionUserByTokenHash(
    hashSessionToken(sessionToken),
  );

  if (!session) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }

  const now = Date.now();
  if (now - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await touchSession(session.sessionId);
  }

  return session.user;
}

export async function getCurrentUserByApiToken(token: string) {
  const user = await findUserByApiTokenHash(hashToken(token));
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  return user;
}

export async function logout(sessionToken: string) {
  await deleteSessionByTokenHash(hashSessionToken(sessionToken));
}

export async function exportAccountData(userId: string) {
  const data = await getAccountDataExport(userId);
  if (!data) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }
  return data;
}

export async function listAccountSessions(input: {
  sessionToken: string;
  userId: string;
}) {
  const currentTokenHash = hashSessionToken(input.sessionToken);
  const sessions = await listActiveSessionsForUser(input.userId);

  return sessions.map((session) => ({
    ...session,
    current: session.tokenHash === currentTokenHash,
  }));
}

export async function revokeAccountSession(input: {
  sessionId: string;
  sessionToken: string;
  userId: string;
}) {
  const session = await deleteSessionForUser({
    sessionId: input.sessionId,
    userId: input.userId,
  });

  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Session was not found");
  }

  return {
    current: session.tokenHash === hashSessionToken(input.sessionToken),
  };
}

export async function revokeOtherAccountSessions(input: {
  sessionToken: string;
  userId: string;
}) {
  await deleteOtherSessionsForUser({
    tokenHash: hashSessionToken(input.sessionToken),
    userId: input.userId,
  });
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileRequest,
) {
  const user = await updateUserDisplayName(userId, input.displayName);

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }

  return user;
}

export async function updateProfileAvatar(
  userId: string,
  file: Express.Multer.File,
) {
  const current = await findUserAvatarById(userId);
  if (!current) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }
  const avatarUrl = await saveImage({ file, kind: "avatars" });
  const user = await updateUserAvatar(userId, avatarUrl);
  if (!user) {
    await deleteStoredImage(avatarUrl);
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }

  await deleteStoredImage(current.avatarUrl);
  return user;
}

export async function removeProfileAvatar(userId: string) {
  const current = await findUserAvatarById(userId);
  if (!current) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }
  const user = await updateUserAvatar(userId, null);
  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }
  await deleteStoredImage(current.avatarUrl);
  return user;
}

export async function changePassword(
  userId: string,
  input: ChangePasswordRequest,
) {
  const user = await findUserPasswordById(userId);
  const passwordMatches = user?.passwordHash
    ? await argon2.verify(user.passwordHash, input.currentPassword)
    : false;

  if (!passwordMatches) {
    throw new AppError(
      400,
      "INVALID_CURRENT_PASSWORD",
      "Current password is incorrect",
    );
  }

  const passwordHash = await argon2.hash(input.newPassword, {
    type: argon2.argon2id,
  });
  const updatedUser = await updatePasswordAndDeleteSessions(
    userId,
    passwordHash,
  );

  if (!updatedUser) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }
}

export async function deleteAccount(userId: string, currentPassword: string) {
  const user = await findUserPasswordById(userId);
  if (
    !user?.passwordHash ||
    !(await argon2.verify(user.passwordHash, currentPassword))
  ) {
    throw new AppError(
      400,
      "INVALID_CURRENT_PASSWORD",
      "Current password is incorrect",
    );
  }
  const result = await deleteAccountAndPersonalWorkspaces(userId);
  if (result.kind === "shared_workspace")
    throw new AppError(
      409,
      "WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED",
      "Transfer ownership of shared workspaces before deleting your account",
    );
  if (result.kind === "user_not_found")
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  await deleteStoredImage(result.avatarUrl);
}

export async function createPersonalApiToken(userId: string, input: CreateApiTokenRequest) {
  const secret = `df_${randomBytes(32).toString("base64url")}`;
  const token = await createApiToken({
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    name: input.name,
    tokenHash: hashToken(secret),
    tokenPrefix: secret.slice(0, 11),
    userId,
  });
  return { token: secret, tokenInfo: toApiTokenInfo(token) };
}

export async function getPersonalApiTokens(userId: string) {
  return (await listApiTokens(userId)).map(toApiTokenInfo);
}

export async function revokePersonalApiToken(userId: string, tokenId: string) {
  if (!(await revokeApiToken(userId, tokenId))) {
    throw new AppError(404, "API_TOKEN_NOT_FOUND", "API token was not found");
  }
}

export async function requestEmailChange(
  userId: string,
  input: ChangeEmailRequest,
) {
  const user = await findUserPasswordById(userId);
  if (
    !user?.passwordHash ||
    !(await argon2.verify(user.passwordHash, input.currentPassword))
  ) {
    throw new AppError(
      400,
      "INVALID_CURRENT_PASSWORD",
      "Current password is incorrect",
    );
  }

  const emailNormalized = normalizeEmail(input.email);
  if (emailNormalized === user.emailNormalized) {
    throw new AppError(
      400,
      "EMAIL_UNCHANGED",
      "Choose an email address different from your current one",
    );
  }
  const currentUser = await findUserByEmailNormalized(emailNormalized);
  if (currentUser) {
    throw new AppError(
      409,
      "EMAIL_ALREADY_REGISTERED",
      "A user with this email already exists",
    );
  }

  const token = generateAuthToken();
  const changedUser = await replaceEmailChangeToken({
    email: input.email.trim(),
    emailNormalized,
    expiresAt: getEmailVerificationExpiresAt(),
    tokenHash: hashToken(token),
    userId,
  });
  if (!changedUser) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }
  return { email: input.email.trim(), token, user: changedUser };
}

export async function issueEmailVerificationToken(user: SessionUser) {
  if (user.emailVerifiedAt) {
    return null;
  }

  const token = generateAuthToken();

  await replaceEmailVerificationToken({
    expiresAt: getEmailVerificationExpiresAt(),
    tokenHash: hashToken(token),
    userId: user.id,
  });

  return token;
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const user =
    (await consumeEmailVerificationToken(tokenHash)) ??
    (await consumeEmailChangeToken(tokenHash));

  if (!user) {
    throw new AppError(
      400,
      "INVALID_EMAIL_VERIFICATION_TOKEN",
      "This email verification link is invalid or has expired",
    );
  }

  return user;
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmailNormalized(normalizeEmail(email));

  if (!user?.passwordHash) {
    return null;
  }

  const token = await issuePasswordResetToken(user);

  return {
    token,
    user,
  };
}

export async function issuePasswordResetToken(user: Pick<User, "id">) {
  const token = generateAuthToken();

  await replacePasswordResetToken({
    expiresAt: getPasswordResetExpiresAt(),
    tokenHash: hashToken(token),
    userId: user.id,
  });

  return token;
}

export async function resetPassword(input: {
  password: string;
  token: string;
}) {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });
  const user = await consumePasswordResetToken({
    passwordHash,
    tokenHash: hashToken(input.token),
  });

  if (!user) {
    throw new AppError(
      400,
      "INVALID_PASSWORD_RESET_TOKEN",
      "This password reset link is invalid or has expired",
    );
  }
}

async function createAuthResult(
  user: SessionUser,
  meta: RequestMeta,
): Promise<AuthResult> {
  const sessionToken = generateSessionToken();
  const sessionExpiresAt = getSessionExpiresAt();

  await createSession({
    expiresAt: sessionExpiresAt,
    ipAddress: meta.ipAddress,
    tokenHash: hashSessionToken(sessionToken),
    userAgent: meta.userAgent,
    userId: user.id,
  });

  return {
    sessionExpiresAt,
    sessionToken,
    user,
  };
}

function generateSessionToken() {
  return generateAuthToken();
}

function hashSessionToken(token: string) {
  return hashToken(token);
}

function generateAuthToken() {
  return randomBytes(sessionTokenBytes).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.SESSION_TTL_DAYS);
  return expiresAt;
}

function getEmailVerificationExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + env.EMAIL_VERIFICATION_TTL_HOURS);
  return expiresAt;
}

function getPasswordResetExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + env.PASSWORD_RESET_TTL_HOURS);
  return expiresAt;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toApiTokenInfo(token: { id: string; name: string; tokenPrefix: string; createdAt: Date; expiresAt: Date | null; lastUsedAt: Date | null }) {
  return { id: token.id, name: token.name, tokenPrefix: token.tokenPrefix, createdAt: token.createdAt.toISOString(), expiresAt: token.expiresAt?.toISOString() ?? null, lastUsedAt: token.lastUsedAt?.toISOString() ?? null };
}

function invalidCredentialsError() {
  return new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
}

async function createRegisteredUser(input: {
  displayName: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
}) {
  try {
    return await createUserWithDefaultWorkspace({
      ...input,
      workspaceSlug: `personal-${randomBytes(6).toString("hex")}`,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "A user with this email already exists",
      );
    }

    throw error;
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

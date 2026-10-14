import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type { LoginRequest, RegisterRequest } from "@devflow/shared";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import {
  createSession,
  createUser,
  deleteSessionByTokenHash,
  findSessionUserByTokenHash,
  findUserByEmailNormalized,
  touchSession,
  type SessionUser
} from "./auth.repository.js";

const sessionTokenBytes = 32;

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type AuthResult = {
  sessionExpiresAt: Date;
  sessionToken: string;
  user: SessionUser;
};

export async function register(
  input: RegisterRequest,
  meta: RequestMeta
): Promise<AuthResult> {
  const emailNormalized = normalizeEmail(input.email);
  const existingUser = await findUserByEmailNormalized(emailNormalized);

  if (existingUser) {
    throw new AppError(
      409,
      "EMAIL_ALREADY_REGISTERED",
      "A user with this email already exists"
    );
  }

  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id
  });

  const user = await createRegisteredUser({
    displayName: input.displayName,
    email: input.email,
    emailNormalized,
    passwordHash
  });

  return createAuthResult(user, meta);
}

export async function login(
  input: LoginRequest,
  meta: RequestMeta
): Promise<AuthResult> {
  const user = await findUserByEmailNormalized(normalizeEmail(input.email));

  if (!user?.passwordHash) {
    throw invalidCredentialsError();
  }

  const passwordMatches = await argon2.verify(user.passwordHash, input.password);

  if (!passwordMatches) {
    throw invalidCredentialsError();
  }

  return createAuthResult(user, meta);
}

export async function getCurrentUser(sessionToken: string) {
  const session = await findSessionUserByTokenHash(
    hashSessionToken(sessionToken)
  );

  if (!session) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }

  await touchSession(session.sessionId);

  return session.user;
}

export async function logout(sessionToken: string) {
  await deleteSessionByTokenHash(hashSessionToken(sessionToken));
}

async function createAuthResult(
  user: SessionUser,
  meta: RequestMeta
): Promise<AuthResult> {
  const sessionToken = generateSessionToken();
  const sessionExpiresAt = getSessionExpiresAt();

  await createSession({
    expiresAt: sessionExpiresAt,
    ipAddress: meta.ipAddress,
    tokenHash: hashSessionToken(sessionToken),
    userAgent: meta.userAgent,
    userId: user.id
  });

  return {
    sessionExpiresAt,
    sessionToken,
    user
  };
}

function generateSessionToken() {
  return randomBytes(sessionTokenBytes).toString("base64url");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.SESSION_TTL_DAYS);
  return expiresAt;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
    return await createUser(input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "A user with this email already exists"
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

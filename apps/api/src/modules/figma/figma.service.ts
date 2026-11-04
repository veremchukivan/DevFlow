import { eq } from "drizzle-orm";

import { env } from "../../config/env.js";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../../core/crypto/integrations.js";
import { db } from "../../core/db/client.js";
import { figmaConnections } from "../../core/db/schema/figma-connections.js";
import { AppError } from "../../core/errors/app-error.js";

type FigmaFileResponse = {
  editorType?: string;
  lastModified?: string;
  name?: string;
  thumbnailUrl?: string;
};

type FigmaRefreshResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

export async function getFigmaFilePreview(input: {
  url: string;
  userId: string;
}) {
  const fileKey = getFigmaFileKey(input.url);
  if (!fileKey) {
    throw new AppError(
      400,
      "FIGMA_FILE_URL_INVALID",
      "Figma URL must include a file, design, or prototype key",
    );
  }

  const [connection] = await db
    .select({
      accessTokenEncrypted: figmaConnections.accessTokenEncrypted,
      expiresAt: figmaConnections.expiresAt,
      refreshTokenEncrypted: figmaConnections.refreshTokenEncrypted,
    })
    .from(figmaConnections)
    .where(eq(figmaConnections.userId, input.userId))
    .limit(1);

  if (!connection) {
    throw new AppError(
      409,
      "FIGMA_CONNECTION_REQUIRED",
      "Connect your Figma account before previewing a file",
    );
  }
  let accessToken = decryptIntegrationSecret(connection.accessTokenEncrypted);
  if (connection.expiresAt <= new Date(Date.now() + 60_000)) {
    accessToken = await refreshFigmaAccessToken({
      refreshTokenEncrypted: connection.refreshTokenEncrypted,
      userId: input.userId,
    });
  }

  let response = await requestFigmaFile(fileKey, accessToken);

  if (response.status === 401 || response.status === 403) {
    accessToken = await refreshFigmaAccessToken({
      refreshTokenEncrypted: connection.refreshTokenEncrypted,
      userId: input.userId,
    });
    response = await requestFigmaFile(fileKey, accessToken);
    if (response.status === 401 || response.status === 403) {
      throw connectionExpiredError();
    }
  }
  if (response.status === 404) {
    throw new AppError(404, "FIGMA_FILE_NOT_FOUND", "Figma file was not found");
  }
  if (response.status === 429) {
    throw new AppError(429, "FIGMA_RATE_LIMITED", "Figma is rate limiting preview requests. Try again shortly.");
  }
  if (!response.ok) {
    throw new AppError(502, "FIGMA_FILE_REQUEST_FAILED", "Unable to load the Figma file preview");
  }

  const file = (await response.json()) as FigmaFileResponse;
  if (!file.name || !file.lastModified) {
    throw new AppError(502, "FIGMA_FILE_RESPONSE_INVALID", "Figma returned an invalid file response");
  }

  const lastModified = new Date(file.lastModified);
  if (Number.isNaN(lastModified.getTime())) {
    throw new AppError(502, "FIGMA_FILE_RESPONSE_INVALID", "Figma returned an invalid file timestamp");
  }

  return {
    editorType: file.editorType ?? null,
    fileKey,
    lastModified: lastModified.toISOString(),
    name: file.name,
    thumbnailUrl: file.thumbnailUrl ?? null,
  };
}

async function requestFigmaFile(fileKey: string, accessToken: string) {
  return fetch(
    `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}?depth=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

async function refreshFigmaAccessToken(input: {
  refreshTokenEncrypted: string;
  userId: string;
}) {
  if (!env.FIGMA_CLIENT_ID || !env.FIGMA_CLIENT_SECRET) {
    throw new AppError(
      503,
      "FIGMA_NOT_CONFIGURED",
      "Figma integration is not configured",
    );
  }

  const basic = Buffer.from(
    `${env.FIGMA_CLIENT_ID}:${env.FIGMA_CLIENT_SECRET}`,
  ).toString("base64");
  let response: Response;
  try {
    response = await fetch("https://api.figma.com/v1/oauth/token", {
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: decryptIntegrationSecret(input.refreshTokenEncrypted),
      }),
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
  } catch {
    throw new AppError(502, "FIGMA_TOKEN_REFRESH_FAILED", "Unable to refresh the Figma connection");
  }

  if (!response.ok) throw connectionExpiredError();
  const token = (await response.json()) as FigmaRefreshResponse;
  if (!token.access_token || !Number.isFinite(token.expires_in)) {
    throw new AppError(502, "FIGMA_TOKEN_REFRESH_FAILED", "Figma returned an invalid token refresh response");
  }

  await db
    .update(figmaConnections)
    .set({
      accessTokenEncrypted: encryptIntegrationSecret(token.access_token),
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      ...(token.refresh_token
        ? { refreshTokenEncrypted: encryptIntegrationSecret(token.refresh_token) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(figmaConnections.userId, input.userId));

  return token.access_token;
}

function connectionExpiredError() {
  return new AppError(
    401,
    "FIGMA_CONNECTION_EXPIRED",
    "Your Figma connection has expired. Reconnect it in Profile settings.",
  );
}

function getFigmaFileKey(value: string) {
  const url = new URL(value);
  const [fileType, fileKey] = url.pathname.split("/").filter(Boolean);
  if (!fileType || !fileKey || !["design", "file", "proto", "board"].includes(fileType)) {
    return null;
  }
  return /^[A-Za-z0-9_-]{4,128}$/.test(fileKey) ? fileKey : null;
}

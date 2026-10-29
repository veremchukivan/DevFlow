import { eq } from "drizzle-orm";

import { decryptIntegrationSecret } from "../../core/crypto/integrations.js";
import { db } from "../../core/db/client.js";
import { figmaConnections } from "../../core/db/schema/figma-connections.js";
import { AppError } from "../../core/errors/app-error.js";

type FigmaFileResponse = {
  editorType?: string;
  lastModified?: string;
  name?: string;
  thumbnailUrl?: string;
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
  if (connection.expiresAt <= new Date()) {
    throw new AppError(
      401,
      "FIGMA_CONNECTION_EXPIRED",
      "Your Figma connection has expired. Reconnect it in Profile settings.",
    );
  }

  const response = await fetch(
    `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}?depth=1`,
    {
      headers: {
        Authorization: `Bearer ${decryptIntegrationSecret(connection.accessTokenEncrypted)}`,
      },
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new AppError(
      401,
      "FIGMA_CONNECTION_EXPIRED",
      "Your Figma connection is no longer authorised. Reconnect it in Profile settings.",
    );
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

function getFigmaFileKey(value: string) {
  const url = new URL(value);
  const [fileType, fileKey] = url.pathname.split("/").filter(Boolean);
  if (!fileType || !fileKey || !["design", "file", "proto", "board"].includes(fileType)) {
    return null;
  }
  return /^[A-Za-z0-9_-]{4,128}$/.test(fileKey) ? fileKey : null;
}

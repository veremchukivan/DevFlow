import { randomBytes } from "node:crypto";
import { Router } from "express";
import { eq } from "drizzle-orm";

import { env } from "../../config/env.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "../../core/crypto/integrations.js";
import { db } from "../../core/db/client.js";
import { figmaConnections } from "../../core/db/schema/figma-connections.js";
import { AppError } from "../../core/errors/app-error.js";
import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";

export const figmaRouter = Router();

figmaRouter.get("/connect", requireAuth, (req, res) => {
  if (
    !env.FIGMA_CLIENT_ID ||
    !env.FIGMA_CLIENT_SECRET ||
    !env.FIGMA_REDIRECT_URI ||
    !env.INTEGRATION_ENCRYPTION_KEY
  ) {
    throw new AppError(503, "FIGMA_NOT_CONFIGURED", "Figma integration is not configured");
  }
  const state = encryptIntegrationSecret(
    JSON.stringify({
      expiresAt: Date.now() + 10 * 60 * 1000,
      nonce: randomBytes(16).toString("base64url"),
      userId: (req as AuthenticatedRequest).auth.user.id,
    }),
  );
  const authorizationUrl = new URL("https://www.figma.com/oauth");
  authorizationUrl.searchParams.set("client_id", env.FIGMA_CLIENT_ID);
  authorizationUrl.searchParams.set("redirect_uri", env.FIGMA_REDIRECT_URI);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "current_user:read file_content:read");
  authorizationUrl.searchParams.set("state", state);
  res.redirect(302, authorizationUrl.toString());
});

figmaRouter.get("/connection", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).auth.user.id;
  const [connection] = await db
    .select({
      connectedAt: figmaConnections.createdAt,
      expiresAt: figmaConnections.expiresAt,
    })
    .from(figmaConnections)
    .where(eq(figmaConnections.userId, userId));

  res.json({ connected: Boolean(connection), connection: connection ?? null });
});

figmaRouter.delete("/connection", requireAuth, async (req, res) => {
  await db
    .delete(figmaConnections)
    .where(
      eq(
        figmaConnections.userId,
        (req as AuthenticatedRequest).auth.user.id,
      ),
    );
  res.status(204).send();
});

figmaRouter.get("/callback", requireAuth, async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (
    !code ||
    !state ||
    !env.FIGMA_CLIENT_ID ||
    !env.FIGMA_CLIENT_SECRET ||
    !env.FIGMA_REDIRECT_URI ||
    !env.INTEGRATION_ENCRYPTION_KEY
  ) {
    throw new AppError(400, "INVALID_FIGMA_CALLBACK", "Figma callback is invalid");
  }

  let payload: { expiresAt: number; userId: string };
  try {
    payload = JSON.parse(decryptIntegrationSecret(state));
  } catch {
    throw new AppError(
      400,
      "INVALID_FIGMA_STATE",
      "Figma authorization state is invalid",
    );
  }

  if (
    payload.expiresAt < Date.now() ||
    payload.userId !== (req as AuthenticatedRequest).auth.user.id
  ) {
    throw new AppError(400, "INVALID_FIGMA_STATE", "Figma authorization state has expired");
  }

  const basic = Buffer.from(`${env.FIGMA_CLIENT_ID}:${env.FIGMA_CLIENT_SECRET}`).toString("base64");
  const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: env.FIGMA_REDIRECT_URI,
    }),
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!tokenResponse.ok) {
    throw new AppError(
      502,
      "FIGMA_TOKEN_EXCHANGE_FAILED",
      "Unable to connect Figma account",
    );
  }

  const token = (await tokenResponse.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    user_id_string: string;
  };
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);

  await db
    .insert(figmaConnections)
    .values({
      accessTokenEncrypted: encryptIntegrationSecret(token.access_token),
      expiresAt,
      figmaUserId: token.user_id_string,
      refreshTokenEncrypted: encryptIntegrationSecret(token.refresh_token),
      userId: payload.userId,
    })
    .onConflictDoUpdate({
      set: {
        accessTokenEncrypted: encryptIntegrationSecret(token.access_token),
        expiresAt,
        figmaUserId: token.user_id_string,
        refreshTokenEncrypted: encryptIntegrationSecret(token.refresh_token),
        updatedAt: new Date(),
      },
      target: figmaConnections.userId,
    });

  res.redirect(302, new URL("/profile?figma=connected", env.WEB_ORIGIN).toString());
});

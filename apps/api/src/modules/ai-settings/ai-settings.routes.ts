import {
  aiSettingsSchema,
  updateAiSettingsRequestSchema,
} from "@devflow/shared";
import { Router } from "express";
import { eq } from "drizzle-orm";

import { env } from "../../config/env.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "../../core/crypto/integrations.js";
import { db } from "../../core/db/client.js";
import { userAiSettings } from "../../core/db/schema/user-ai-settings.js";
import { AppError } from "../../core/errors/app-error.js";
import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";

export const aiSettingsRouter = Router();

aiSettingsRouter.use(requireAuth);

aiSettingsRouter.get("/", async (req, res) => {
  const [settings] = await db
    .select({
      model: userAiSettings.model,
      provider: userAiSettings.provider,
      updatedAt: userAiSettings.updatedAt,
    })
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, (req as AuthenticatedRequest).auth.user.id));

  res.json(
    aiSettingsSchema.parse({
      configured: Boolean(settings),
      model: settings?.model ?? null,
      provider: settings?.provider ?? null,
      updatedAt: settings?.updatedAt?.toISOString() ?? null,
    }),
  );
});

aiSettingsRouter.put("/", async (req, res) => {
  requireEncryptionKey();
  const input = updateAiSettingsRequestSchema.parse(req.body);
  const userId = (req as AuthenticatedRequest).auth.user.id;
  const [settings] = await db
    .insert(userAiSettings)
    .values({
      apiKeyEncrypted: encryptIntegrationSecret(input.apiKey),
      model: input.model ?? null,
      provider: input.provider,
      userId,
    })
    .onConflictDoUpdate({
      set: {
        apiKeyEncrypted: encryptIntegrationSecret(input.apiKey),
        model: input.model ?? null,
        provider: input.provider,
        updatedAt: new Date(),
      },
      target: userAiSettings.userId,
    })
    .returning({
      model: userAiSettings.model,
      provider: userAiSettings.provider,
      updatedAt: userAiSettings.updatedAt,
    });

  res.json(
    aiSettingsSchema.parse({
      configured: true,
      model: settings?.model ?? null,
      provider: settings?.provider ?? null,
      updatedAt: settings?.updatedAt?.toISOString() ?? null,
    }),
  );
});

aiSettingsRouter.delete("/", async (req, res) => {
  await db
    .delete(userAiSettings)
    .where(eq(userAiSettings.userId, (req as AuthenticatedRequest).auth.user.id));
  res.status(204).send();
});

export async function getDecryptedAiApiKey(userId: string) {
  const [settings] = await db
    .select({
      apiKeyEncrypted: userAiSettings.apiKeyEncrypted,
      model: userAiSettings.model,
      provider: userAiSettings.provider,
    })
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId));

  if (!settings) return null;

  return {
    apiKey: decryptIntegrationSecret(settings.apiKeyEncrypted),
    model: settings.model,
    provider: settings.provider as "anthropic" | "openai",
  };
}

function requireEncryptionKey() {
  if (!env.INTEGRATION_ENCRYPTION_KEY) {
    throw new AppError(
      503,
      "AI_SETTINGS_NOT_CONFIGURED",
      "AI settings are not configured on this server",
    );
  }
}

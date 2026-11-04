import { z } from "zod";

export const aiProviderSchema = z.enum(["anthropic", "openai"]);

export const updateAiSettingsRequestSchema = z.object({
  apiKey: z.string().trim().min(8).max(500),
  model: z.string().trim().min(1).max(160).nullable().optional(),
  provider: aiProviderSchema,
});

export const aiSettingsSchema = z.object({
  configured: z.boolean(),
  model: z.string().nullable(),
  provider: aiProviderSchema.nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type UpdateAiSettingsRequest = z.infer<
  typeof updateAiSettingsRequestSchema
>;

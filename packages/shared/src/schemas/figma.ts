import { z } from "zod";

export const figmaFilePreviewQuerySchema = z.object({
  url: z
    .url()
    .refine(
      (value) => /^https?:\/\/(?:[a-z0-9-]+\.)*figma\.com(?:[/:?#]|$)/i.test(value),
      { message: "Figma URL must point to figma.com" },
    ),
});

export const figmaFilePreviewSchema = z.object({
  editorType: z.string().nullable(),
  fileKey: z.string(),
  lastModified: z.string().datetime(),
  name: z.string(),
  thumbnailUrl: z.url().nullable(),
});

export const figmaFilePreviewResponseSchema = z.object({
  preview: figmaFilePreviewSchema,
});

export type FigmaFilePreview = z.infer<typeof figmaFilePreviewSchema>;

import { z } from "zod";

export const labelColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const labelSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string(),
  color: labelColorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const createLabelRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: labelColorSchema,
});
export const updateLabelRequestSchema = createLabelRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const labelParamsSchema = z.object({
  workspaceId: z.uuid(),
  labelId: z.uuid(),
});
export const workspaceLabelsParamsSchema = z.object({ workspaceId: z.uuid() });
export const labelResponseSchema = z.object({ label: labelSchema });
export const labelListResponseSchema = z.object({
  labels: z.array(labelSchema),
});
export const taskLabelsRequestSchema = z.object({
  labelIds: z.array(z.uuid()).max(20),
});
export type Label = z.infer<typeof labelSchema>;
export type CreateLabelRequest = z.infer<typeof createLabelRequestSchema>;
export type UpdateLabelRequest = z.infer<typeof updateLabelRequestSchema>;
export type LabelListResponse = z.infer<typeof labelListResponseSchema>;

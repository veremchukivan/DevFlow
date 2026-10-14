import { z } from "zod";

export const defaultPageLimit = 20;
export const maxPageLimit = 100;

export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(maxPageLimit)
    .default(defaultPageLimit),
  offset: z.coerce.number().int().min(0).default(0)
});

export const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  limit: z.number().int().min(1).max(maxPageLimit),
  offset: z.number().int().min(0),
  total: z.number().int().min(0)
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PageInfo = z.infer<typeof pageInfoSchema>;

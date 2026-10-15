import "dotenv/config";

import { z } from "zod";

const envSchema = z
  .object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://devflow:devflow@localhost:5432/devflow"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SESSION_COOKIE_NAME: z.string().min(1).default("devflow_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    SESSION_CLEANUP_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  COOKIE_SECURE: z.coerce.boolean().optional(),
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
    REDIS_URL: z.url().optional()
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.REDIS_URL) {
      context.addIssue({
        code: "custom",
        message: "REDIS_URL is required in production",
        path: ["REDIS_URL"]
      });
    }
  });

export const env = envSchema.parse(process.env);


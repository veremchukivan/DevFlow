import dotenv from "dotenv";
import { resolve } from "node:path";

import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  return value;
}, z.boolean());

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
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce
      .number()
      .int()
      .positive()
      .default(24),
    PASSWORD_RESET_TTL_HOURS: z.coerce.number().int().positive().default(1),
    INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(7),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    RATE_LIMIT_WINDOW_MS: z
      .coerce.number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    COOKIE_SECURE: booleanFromEnv.optional(),
    SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
    REDIS_URL: z.url().optional(),
    SMTP_HOST: optionalNonEmptyString,
    SMTP_PORT: z.coerce.number().int().positive().max(65_535).default(587),
    SMTP_SECURE: booleanFromEnv.default(false),
    SMTP_USER: optionalNonEmptyString,
    SMTP_PASSWORD: optionalNonEmptyString,
    SMTP_FROM: optionalNonEmptyString
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.REDIS_URL) {
      context.addIssue({
        code: "custom",
        message: "REDIS_URL is required in production",
        path: ["REDIS_URL"]
      });
    }

    if (value.NODE_ENV === "production") {
      if (!value.SMTP_HOST) {
        context.addIssue({
          code: "custom",
          message: "SMTP_HOST is required in production",
          path: ["SMTP_HOST"]
        });
      }

      if (!value.SMTP_FROM) {
        context.addIssue({
          code: "custom",
          message: "SMTP_FROM is required in production",
          path: ["SMTP_FROM"]
        });
      }
    }

    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
      context.addIssue({
        code: "custom",
        message: "SMTP_USER and SMTP_PASSWORD must be configured together",
        path: ["SMTP_USER"]
      });
    }
  });

export const env = envSchema.parse(process.env);


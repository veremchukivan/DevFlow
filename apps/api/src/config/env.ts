import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  WEB_ORIGIN: z.url().default("http://localhost:3000")
});

export const env = envSchema.parse(process.env);


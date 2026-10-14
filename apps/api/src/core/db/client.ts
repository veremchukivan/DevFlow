import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../../config/env.js";
import * as schema from "./schema/index.js";

export const postgresClient = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,
  transform: {
    undefined: null
  }
});

export const db = drizzle(postgresClient, { schema });

export type DbClient = typeof db;
export type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = DbClient | TxClient;

export async function closeDbConnection() {
  await postgresClient.end({ timeout: 5 });
}

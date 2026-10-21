import { createClient, type RedisClientType } from "redis";

import { env } from "../../config/env.js";

const redisUrl = env.NODE_ENV === "test" ? undefined : env.REDIS_URL;

export const redisClient: RedisClientType | undefined = redisUrl
  ? createClient({ url: redisUrl })
  : undefined;

redisClient?.on("error", (error) => {
  console.error("Redis client error", error);
});

export async function connectRedis() {
  if (redisClient && !redisClient.isOpen) {
    await redisClient.connect();
  }
}

export async function closeRedisConnection() {
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }
}

type RedisReadinessClient = Pick<RedisClientType, "isReady" | "ping">;

export async function checkRedisReadiness(
  client: RedisReadinessClient | undefined = redisClient
) {
  if (!client) {
    return "not_configured" as const;
  }

  if (!client.isReady) {
    return "error" as const;
  }

  try {
    await client.ping();
    return "ok" as const;
  } catch {
    return "error" as const;
  }
}

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

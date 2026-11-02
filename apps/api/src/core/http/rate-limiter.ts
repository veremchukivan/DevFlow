import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import { env } from "../../config/env.js";
import { redisClient } from "../redis/client.js";

function createRedisStore(prefix: string) {
  const client = redisClient;

  if (!client) {
    return undefined;
  }

  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => client.sendCommand(args)
  });
}

export const apiRateLimiter = rateLimit({
  store: createRedisStore("devflow:rate-limit:api:"),
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Authentication has a separate, stricter limiter. Counting those requests
  // in the broad API bucket makes a busy local session lock users out before
  // the authentication protection can make a meaningful decision.
  skip: (request: Request) =>
    env.NODE_ENV === "test" ||
    env.E2E_TEST_MODE ||
    request.originalUrl.startsWith("/api/v1/auth/"),
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again later"
    }
  }
});

export const authRateLimiter = rateLimit({
  store: createRedisStore("devflow:rate-limit:auth:"),
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test" || env.E2E_TEST_MODE,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again later"
    }
  }
});


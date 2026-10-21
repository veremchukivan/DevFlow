import { describe, expect, it } from "vitest";

import { parseEnv } from "../src/config/env.js";

const productionEnvironment = {
  DATABASE_URL: "postgres://runtime:secret@postgres:5432/devflow",
  NODE_ENV: "production",
  REDIS_URL: "redis://redis:6379",
  SMTP_FROM: "DevFlow <no-reply@example.com>",
  SMTP_HOST: "smtp.example.com",
  WEB_ORIGIN: "https://app.example.com"
};

describe("environment validation", () => {
  it("accepts an explicit, secure production configuration", () => {
    expect(parseEnv(productionEnvironment)).toMatchObject({
      NODE_ENV: "production",
      SESSION_COOKIE_SAME_SITE: "lax",
      SHUTDOWN_TIMEOUT_MS: 10_000
    });
  });

  it("requires database and web origins to be explicit in production", () => {
    expect(() =>
      parseEnv({ ...productionEnvironment, DATABASE_URL: undefined })
    ).toThrow("DATABASE_URL");
    expect(() =>
      parseEnv({ ...productionEnvironment, WEB_ORIGIN: undefined })
    ).toThrow("WEB_ORIGIN");
  });

  it("rejects insecure session cookie settings", () => {
    expect(() =>
      parseEnv({ ...productionEnvironment, COOKIE_SECURE: "false" })
    ).toThrow("COOKIE_SECURE cannot be false in production");
    expect(() =>
      parseEnv({
        COOKIE_SECURE: "false",
        SESSION_COOKIE_SAME_SITE: "none"
      })
    ).toThrow("SESSION_COOKIE_SAME_SITE=none requires COOKIE_SECURE=true");
  });

  it("requires a practical graceful shutdown timeout", () => {
    expect(() =>
      parseEnv({ SHUTDOWN_TIMEOUT_MS: "999" })
    ).toThrow(">=1000");
  });
});

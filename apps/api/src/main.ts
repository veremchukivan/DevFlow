import { env } from "./config/env.js";
import { closeDbConnection } from "./core/db/client.js";
import {
  closeRedisConnection,
  connectRedis
} from "./core/redis/client.js";

async function start() {
  await connectRedis();
  const { createApp } = await import("./app.js");
  const { purgeExpiredSessions, scheduleSessionCleanup } = await import(
    "./modules/auth/session-cleanup.js"
  );

  await purgeExpiredSessions();
  const stopSessionCleanup = scheduleSessionCleanup();

  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    console.log(`DevFlow API listening on http://localhost:${env.API_PORT}`);
  });

  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals) {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}, shutting down DevFlow API`);
    stopSessionCleanup();

    const forceExitTimer = setTimeout(() => {
      console.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    server.close((error) => {
      void finishShutdown(error, forceExitTimer);
    });
  }

  async function finishShutdown(
    serverError: Error | undefined,
    forceExitTimer: NodeJS.Timeout
  ) {
    clearTimeout(forceExitTimer);

    try {
      await Promise.all([closeDbConnection(), closeRedisConnection()]);
    } catch (error) {
      console.error("Failed to close API dependencies", error);
      process.exit(1);
      return;
    }

    if (serverError) {
      console.error(serverError);
      process.exit(1);
      return;
    }

    process.exit(0);
  }

  process.on("SIGINT", (signal) => {
    void shutdown(signal);
  });

  process.on("SIGTERM", (signal) => {
    void shutdown(signal);
  });
}

void start().catch((error: unknown) => {
  console.error("Failed to start DevFlow API", error);
  process.exit(1);
});

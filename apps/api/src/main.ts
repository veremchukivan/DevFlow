import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDbConnection } from "./core/db/client.js";

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

  server.close(async (error) => {
    await closeDbConnection();

    if (error) {
      console.error(error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});

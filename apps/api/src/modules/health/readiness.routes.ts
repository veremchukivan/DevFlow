import { sql } from "drizzle-orm";
import { Router } from "express";

import { db } from "../../core/db/client.js";
import { checkRedisReadiness } from "../../core/redis/client.js";

export const readinessRouter = Router();

readinessRouter.get("/", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    const redis = await checkRedisReadiness();

    if (redis === "error") {
      res.status(503).json({
        checks: {
          database: "ok",
          redis
        },
        status: "error",
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      checks: {
        database: "ok",
        redis
      },
      status: "ok",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);

    res.status(503).json({
      checks: {
        database: "error",
        redis: "unknown"
      },
      status: "error",
      timestamp: new Date().toISOString()
    });
  }
});

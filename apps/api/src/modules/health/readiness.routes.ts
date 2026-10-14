import { sql } from "drizzle-orm";
import { Router } from "express";

import { db } from "../../core/db/client.js";

export const readinessRouter = Router();

readinessRouter.get("/", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);

    res.json({
      checks: {
        database: "ok"
      },
      status: "ok",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);

    res.status(503).json({
      checks: {
        database: "error"
      },
      status: "error",
      timestamp: new Date().toISOString()
    });
  }
});

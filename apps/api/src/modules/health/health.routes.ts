import { Router } from "express";
import type { HealthResponse } from "@devflow/shared";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const response: HealthResponse = {
    service: "devflow-api",
    status: "ok",
    timestamp: new Date().toISOString()
  };

  res.json(response);
});


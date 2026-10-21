import { Router } from "express";

import { openApiDocument } from "./document.js";

export const openApiRouter = Router();

openApiRouter.get("/", (_req, res) => {
  res.json(openApiDocument);
});

import {
  notificationListQuerySchema,
  notificationListResponseSchema,
  notificationParamsSchema,
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  getNotifications,
  readAllNotifications,
  readNotification,
} from "./notifications.service.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const result = await getNotifications({
    pagination: notificationListQuerySchema.parse(req.query),
    userId: getUserId(req),
  });
  res.json({
    ...result,
    notifications: result.notifications.map((notification) => ({
      ...notification,
      actor:
        notification.actor?.id && notification.actor.displayName
          ? notification.actor
          : null,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
    })),
  } satisfies typeof notificationListResponseSchema._output);
});

notificationsRouter.post("/:notificationId/read", async (req, res) => {
  const { notificationId } = notificationParamsSchema.parse(req.params);
  await readNotification({ notificationId, userId: getUserId(req) });
  res.status(204).send();
});

notificationsRouter.post("/read-all", async (req, res) => {
  await readAllNotifications({ userId: getUserId(req) });
  res.status(204).send();
});

function getUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

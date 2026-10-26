import {
  taskAttachmentListResponseSchema,
  taskAttachmentParamsSchema,
  taskAttachmentResponseSchema,
  taskAttachmentsParamsSchema,
} from "@devflow/shared";
import { Router, type Request, type Response } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { taskAttachmentUpload } from "../../core/uploads/images.js";
import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  addAttachment,
  downloadAttachment,
  listAttachments,
  removeAttachment,
} from "./task-attachments.service.js";

export const taskAttachmentsRouter = Router({ mergeParams: true });

taskAttachmentsRouter.use(requireAuth);

taskAttachmentsRouter.get("/", async (req, res) => {
  const params = taskAttachmentsParamsSchema.parse(req.params);
  const attachments = await listAttachments({
    ...params,
    userId: getAuthenticatedUserId(req),
  });
  res.json({
    attachments: attachments.map(toTaskAttachmentDto),
  } satisfies typeof taskAttachmentListResponseSchema._output);
});

taskAttachmentsRouter.post(
  "/",
  taskAttachmentUpload.single("file"),
  async (req, res) => {
    const params = taskAttachmentsParamsSchema.parse(req.params);
    if (!req.file) {
      throw new AppError(400, "ATTACHMENT_REQUIRED", "Choose a file to upload");
    }
    const attachment = await addAttachment({
      ...params,
      file: req.file,
      userId: getAuthenticatedUserId(req),
    });
    res.status(201).json({
      attachment: toTaskAttachmentDto(attachment),
    } satisfies typeof taskAttachmentResponseSchema._output);
  },
);

taskAttachmentsRouter.get("/:attachmentId/download", async (req, res) => {
  const params = taskAttachmentParamsSchema.parse(req.params);
  const { attachment, content } = await downloadAttachment({
    ...params,
    userId: getAuthenticatedUserId(req),
  });
  res
    .set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalFilename)}`,
      "Content-Type": attachment.mimeType,
      "X-Content-Type-Options": "nosniff",
    })
    .send(content);
});

taskAttachmentsRouter.get("/:attachmentId/preview", async (req, res) => {
  const params = taskAttachmentParamsSchema.parse(req.params);
  const { attachment, content } = await downloadAttachment({
    ...params,
    userId: getAuthenticatedUserId(req),
  });
  sendInlineAttachment(req, res, attachment, content);
});

taskAttachmentsRouter.delete("/:attachmentId", async (req, res) => {
  const params = taskAttachmentParamsSchema.parse(req.params);
  await removeAttachment({ ...params, userId: getAuthenticatedUserId(req) });
  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function sendInlineAttachment(
  req: Request,
  res: Response,
  attachment: { mimeType: string; originalFilename: string },
  content: Buffer,
) {
  const baseHeaders = {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalFilename)}`,
    "Content-Type": attachment.mimeType,
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  };

  if (!attachment.mimeType.startsWith("video/")) {
    res.set({ ...baseHeaders, "Content-Length": content.length }).send(content);
    return;
  }

  const range = req.headers.range;
  if (!range) {
    res
      .set({
        ...baseHeaders,
        "Accept-Ranges": "bytes",
        "Content-Length": content.length,
      })
      .send(content);
    return;
  }

  const [startValue, endValue] = range.replace(/^bytes=/, "").split("-");
  const start = Number.parseInt(startValue ?? "", 10);
  const end = endValue
    ? Math.min(Number.parseInt(endValue, 10), content.length - 1)
    : content.length - 1;

  if (
    !Number.isFinite(start) ||
    start < 0 ||
    start >= content.length ||
    end < start
  ) {
    res.status(416).set("Content-Range", `bytes */${content.length}`).end();
    return;
  }

  const chunk = content.subarray(start, end + 1);
  res
    .status(206)
    .set({
      ...baseHeaders,
      "Accept-Ranges": "bytes",
      "Content-Length": chunk.length,
      "Content-Range": `bytes ${start}-${end}/${content.length}`,
    })
    .send(chunk);
}

function toTaskAttachmentDto(attachment: {
  createdAt: Date;
  id: string;
  mimeType: string;
  originalFilename: string;
  projectId: string;
  sizeBytes: number;
  taskId: string;
  uploadedBy?: { displayName: string | null; id: string | null } | null;
  uploadedByUserId: string | null;
  workspaceId: string;
}) {
  return {
    createdAt: attachment.createdAt.toISOString(),
    id: attachment.id,
    mimeType: attachment.mimeType,
    originalFilename: attachment.originalFilename,
    projectId: attachment.projectId,
    sizeBytes: attachment.sizeBytes,
    taskId: attachment.taskId,
    uploadedBy:
      attachment.uploadedBy?.id && attachment.uploadedBy.displayName
        ? {
            displayName: attachment.uploadedBy.displayName,
            id: attachment.uploadedBy.id,
          }
        : null,
    uploadedByUserId: attachment.uploadedByUserId,
    workspaceId: attachment.workspaceId,
  };
}

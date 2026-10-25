import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import multer from "multer";

import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

const maxImageBytes = 2 * 1024 * 1024;
const maxAttachmentBytes = 10 * 1024 * 1024;
const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
const attachmentExtensions = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const imageUpload = multer({
  fileFilter: (_req, file, callback) => {
    if (file.mimetype in extensions) {
      callback(null, true);
      return;
    }
    callback(
      new AppError(
        400,
        "IMAGE_TYPE_INVALID",
        "Upload a PNG, JPEG, or WebP image",
      ),
    );
  },
  limits: { fileSize: maxImageBytes, files: 1 },
  storage: multer.memoryStorage(),
});

export const taskAttachmentUpload = multer({
  fileFilter: (_req, file, callback) => {
    if (file.mimetype in attachmentExtensions) {
      callback(null, true);
      return;
    }
    callback(
      new AppError(
        400,
        "ATTACHMENT_TYPE_INVALID",
        "Upload a PDF, PNG, JPEG, or WebP file",
      ),
    );
  },
  limits: { fileSize: maxAttachmentBytes, files: 1 },
  storage: multer.memoryStorage(),
});

export async function saveImage(input: {
  file: Express.Multer.File;
  kind: "avatars" | "projects";
}) {
  const extension = extensions[input.file.mimetype as keyof typeof extensions];
  if (!extension) {
    throw new AppError(
      400,
      "IMAGE_TYPE_INVALID",
      "Upload a PNG, JPEG, or WebP image",
    );
  }

  const filename = `${randomUUID()}.${extension}`;
  const relativePath = `${input.kind}/${filename}`;
  const absolutePath = join(resolve(env.UPLOADS_DIR), relativePath);
  await mkdir(join(resolve(env.UPLOADS_DIR), input.kind), { recursive: true });
  await writeFile(absolutePath, input.file.buffer, { flag: "wx" });
  return `/uploads/${relativePath}`;
}

export async function deleteStoredImage(url: string | null | undefined) {
  if (!url?.startsWith("/uploads/")) return;
  const relativePath = url.slice("/uploads/".length);
  if (relativePath.includes("..")) return;
  await rm(join(resolve(env.UPLOADS_DIR), relativePath), { force: true });
}

export async function saveTaskAttachment(file: Express.Multer.File) {
  const extension =
    attachmentExtensions[file.mimetype as keyof typeof attachmentExtensions];
  if (!extension) {
    throw new AppError(
      400,
      "ATTACHMENT_TYPE_INVALID",
      "Upload a PDF, PNG, JPEG, or WebP file",
    );
  }

  const filename = `${randomUUID()}.${extension}`;
  const storageKey = `task-attachments/${filename}`;
  const absolutePath = getStoredFilePath(storageKey);
  await mkdir(join(resolve(env.UPLOADS_DIR), "task-attachments"), {
    recursive: true,
  });
  await writeFile(absolutePath, file.buffer, { flag: "wx" });
  return storageKey;
}

export async function deleteStoredFile(storageKey: string) {
  if (!isSafeStorageKey(storageKey)) return;
  await rm(getStoredFilePath(storageKey), { force: true });
}

export async function readStoredFile(storageKey: string) {
  if (!isSafeStorageKey(storageKey)) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  }
  return readFile(getStoredFilePath(storageKey));
}

function getStoredFilePath(storageKey: string) {
  return join(resolve(env.UPLOADS_DIR), storageKey);
}

function isSafeStorageKey(storageKey: string) {
  return (
    storageKey.startsWith("task-attachments/") &&
    !storageKey.includes("..") &&
    !storageKey.includes("\\")
  );
}

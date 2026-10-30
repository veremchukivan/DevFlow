import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import multer from "multer";

import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

const maxImageBytes = 2 * 1024 * 1024;
const maxAttachmentBytes = 50 * 1024 * 1024;
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
  "video/mp4": "mp4",
  "video/webm": "webm",
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
        "Upload a PDF, PNG, JPEG, WebP, MP4, or WebM file",
      ),
    );
  },
  limits: { fileSize: maxAttachmentBytes, files: 1 },
  storage: multer.memoryStorage(),
});

export async function saveImage(input: {
  file: Express.Multer.File;
  kind: "avatars" | "projects" | "workspaces";
}) {
  assertFileSignature(input.file);
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
  assertFileSignature(file);
  const extension =
    attachmentExtensions[file.mimetype as keyof typeof attachmentExtensions];
  if (!extension) {
    throw new AppError(
      400,
      "ATTACHMENT_TYPE_INVALID",
      "Upload a PDF, PNG, JPEG, WebP, MP4, or WebM file",
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

export async function getStoredFileSize(storageKey: string) {
  if (!isSafeStorageKey(storageKey)) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  }
  const metadata = await stat(getStoredFilePath(storageKey));
  if (!metadata.isFile()) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  }
  return metadata.size;
}

export function createStoredFileStream(input: {
  end?: number;
  start?: number;
  storageKey: string;
}) {
  if (!isSafeStorageKey(input.storageKey)) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  }
  return createReadStream(getStoredFilePath(input.storageKey), {
    end: input.end,
    start: input.start,
  });
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

function assertFileSignature(
  file: Pick<Express.Multer.File, "buffer" | "mimetype">,
) {
  if (hasExpectedSignature(file.buffer, file.mimetype)) return;

  throw new AppError(
    400,
    "FILE_CONTENT_INVALID",
    "Uploaded file content does not match its declared type",
  );
}

function hasExpectedSignature(content: Buffer, mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return hasBytes(content, [0xff, 0xd8, 0xff]);
    case "image/png":
      return hasBytes(
        content,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case "image/webp":
      return hasText(content, 0, "RIFF") && hasText(content, 8, "WEBP");
    case "application/pdf":
      return hasText(content, 0, "%PDF-");
    case "video/mp4":
      return hasText(content, 4, "ftyp");
    case "video/webm":
      return hasBytes(content, [0x1a, 0x45, 0xdf, 0xa3]);
    default:
      return false;
  }
}

function hasBytes(content: Buffer, expected: number[]) {
  return expected.every((byte, index) => content[index] === byte);
}

function hasText(content: Buffer, offset: number, expected: string) {
  return (
    content.subarray(offset, offset + expected.length).toString("ascii") ===
    expected
  );
}

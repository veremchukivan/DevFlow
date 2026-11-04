import sanitizeHtml from "sanitize-html";

import { AppError } from "../errors/app-error.js";

const allowedTags = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul",
  "video",
];

const embeddedAttachmentPattern =
  /<(img|video)\s+[^>]*data-task-attachment-id=["']([^"']+)["'][^>]*>(?:<\/video>)?/gi;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeRichText(value: string, fieldName: string) {
  const html = sanitizeHtml(value, {
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["alt", "data-task-attachment-id"],
      span: ["style"],
      video: ["controls", "data-task-attachment-id"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\((?:\d{1,3},\s*){2}\d{1,3}\)$/i],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedTags,
    disallowedTagsMode: "discard",
  }).trim();

  const normalizedHtml = normalizeEmbeddedAttachments(html);
  const plainText = sanitizeHtml(normalizedHtml, { allowedTags: [] })
    .replace(/\u00a0/g, " ")
    .trim();
  if (
    !plainText &&
    extractEmbeddedAttachmentReferences(normalizedHtml).length === 0
  ) {
    throw new AppError(400, "RICH_TEXT_EMPTY", `${fieldName} cannot be empty`);
  }

  return normalizedHtml;
}

export function sanitizeOptionalRichText(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === "") return null;
  return sanitizeRichText(value, "Description");
}

export function extractEmbeddedAttachmentReferences(value: string) {
  return Array.from(value.matchAll(embeddedAttachmentPattern)).flatMap(
    ([, kind, attachmentId]) =>
      attachmentId && uuidPattern.test(attachmentId)
        ? [{ attachmentId, kind: kind as "img" | "video" }]
        : [],
  );
}

function normalizeEmbeddedAttachments(value: string) {
  return value.replace(embeddedAttachmentPattern, (tag, kind, attachmentId) => {
    if (!uuidPattern.test(attachmentId)) return "";
    return kind.toLowerCase() === "video"
      ? `<video controls data-task-attachment-id="${attachmentId}"></video>`
      : `<img data-task-attachment-id="${attachmentId}" alt="">`;
  });
}

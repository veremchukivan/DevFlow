import sanitizeHtml from "sanitize-html";

import { AppError } from "../errors/app-error.js";

const allowedTags = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
];

export function sanitizeRichText(value: string, fieldName: string) {
  const html = sanitizeHtml(value, {
    allowedAttributes: {
      a: ["href", "rel", "target"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedTags,
    disallowedTagsMode: "discard",
  }).trim();

  const plainText = sanitizeHtml(html, { allowedTags: [] }).replace(/\u00a0/g, " ").trim();
  if (!plainText) {
    throw new AppError(400, "RICH_TEXT_EMPTY", `${fieldName} cannot be empty`);
  }

  return html;
}

export function sanitizeOptionalRichText(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === "") return null;
  return sanitizeRichText(value, "Description");
}

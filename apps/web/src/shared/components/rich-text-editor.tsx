"use client";

import {
  BlockquotePlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { FontColorPlugin } from "@platejs/basic-styles/react";
import { upsertLink } from "@platejs/link";
import { LinkPlugin } from "@platejs/link/react";
import { ListStyleType, toggleList } from "@platejs/list";
import { ListPlugin } from "@platejs/list/react";
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Quote,
  Underline,
  Video,
  X,
} from "lucide-react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import {
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Modal } from "./modal";
import styles from "./rich-text-editor.module.css";

type RichTextAttachment = {
  id: string;
  mimeType: string;
  originalFilename: string;
};

type RichTextEditorProps = {
  attachments?: RichTextAttachment[];
  defaultValue?: string | null;
  form?: string;
  getAttachmentPreviewUrl?: (attachmentId: string) => string | undefined;
  id: string;
  maxLength: number;
  name: string;
  onMediaChange?: (value: string) => Promise<void>;
  onMediaUpload?: (files: File[]) => Promise<RichTextAttachment[]>;
  placeholder: string;
  resetKey?: number;
};

type PlateNode = {
  bold?: boolean;
  children?: PlateNode[];
  color?: string;
  italic?: boolean;
  listStyleType?: string;
  text?: string;
  type?: string;
  underline?: boolean;
  url?: string;
};

type EmbeddedMedia = {
  attachmentId: string;
  kind: "image" | "video";
};

const embeddedMediaPattern =
  /<(img|video)\s+[^>]*data-task-attachment-id=["']([^"']+)["'][^>]*>(?:<\/video>)?/gi;

export function RichTextEditor({
  attachments = [],
  defaultValue,
  form,
  getAttachmentPreviewUrl,
  id,
  maxLength,
  name,
  onMediaChange,
  onMediaUpload,
  placeholder,
  resetKey,
}: RichTextEditorProps) {
  const [value, setValue] = useState(() => normalizeHtml(defaultValue));
  const [isActive, setIsActive] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<RichTextAttachment>();
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const nextValue = normalizeHtml(defaultValue);
    if (valueRef.current === nextValue) return;
    setValue(nextValue);
    setIsActive(false);
  }, [defaultValue, resetKey]);

  const embeddedMedia = useMemo(() => extractEmbeddedMedia(value), [value]);

  function closeIfFocusLeaves() {
    window.setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsActive(false);
      }
    }, 0);
  }

  async function appendMedia(uploadedAttachments: RichTextAttachment[]) {
    const nextValue = appendEmbeddedMedia(
      valueRef.current,
      uploadedAttachments.filter(isSupportedMedia).map((attachment) => ({
        attachmentId: attachment.id,
        kind: attachment.mimeType.startsWith("video/") ? "video" : "image",
      })),
    );
    valueRef.current = nextValue;
    setValue(nextValue);
    await onMediaChange?.(nextValue);
  }

  async function removeMedia(attachmentId: string) {
    const nextValue = removeEmbeddedMedia(valueRef.current, attachmentId);
    valueRef.current = nextValue;
    setValue(nextValue);
    await onMediaChange?.(nextValue);
  }

  function handlePreviewClick(event: MouseEvent<HTMLButtonElement>) {
    const mediaElement = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-description-media-id]",
    );
    const attachmentId = mediaElement?.dataset.descriptionMediaId;
    const attachment = attachments.find((item) => item.id === attachmentId);

    if (attachment) {
      event.preventDefault();
      event.stopPropagation();
      setSelectedMedia(attachment);
      return;
    }
    setIsActive(true);
  }

  return (
    <div
      className={styles.editor}
      onBlur={closeIfFocusLeaves}
      ref={containerRef}
    >
      <input form={form} name={name} type="hidden" value={value} />
      {isActive ? (
        <PlateEditorSurface
          attachments={attachments}
          embeddedMedia={embeddedMedia}
          getAttachmentPreviewUrl={getAttachmentPreviewUrl}
          id={id}
          initialValue={stripEmbeddedMedia(value)}
          maxLength={maxLength}
          onChange={(nextValue) =>
            setValue(
              appendEmbeddedMedia(nextValue, extractEmbeddedMedia(value)),
            )
          }
          onMediaInserted={appendMedia}
          onMediaUpload={onMediaUpload}
          onRemoveMedia={removeMedia}
          placeholder={placeholder}
        />
      ) : (
        <button
          aria-label={placeholder}
          className={styles.previewButton}
          onClick={handlePreviewClick}
          type="button"
        >
          {hasContent(value) ? (
            <RichTextContent
              attachments={attachments}
              getAttachmentPreviewUrl={getAttachmentPreviewUrl}
              value={value}
            />
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </button>
      )}
      {selectedMedia ? (
        <Modal
          isOpen
          onClose={() => setSelectedMedia(undefined)}
          title={selectedMedia.originalFilename}
          width="wide"
        >
          <div className={styles.mediaPreviewDialog}>
            {selectedMedia.mimeType.startsWith("video/") ? (
              <video controls preload="metadata">
                <source
                  src={getAttachmentPreviewUrl?.(selectedMedia.id)}
                  type={selectedMedia.mimeType}
                />
              </video>
            ) : (
              // Attachment previews are authenticated API resources. A native img
              // keeps the existing session credentials on the asset request.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={selectedMedia.originalFilename}
                src={getAttachmentPreviewUrl?.(selectedMedia.id)}
              />
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function PlateEditorSurface({
  attachments,
  embeddedMedia,
  getAttachmentPreviewUrl,
  id,
  initialValue,
  maxLength,
  onChange,
  onMediaInserted,
  onMediaUpload,
  onRemoveMedia,
  placeholder,
}: {
  attachments: RichTextAttachment[];
  embeddedMedia: EmbeddedMedia[];
  getAttachmentPreviewUrl?: (attachmentId: string) => string | undefined;
  id: string;
  initialValue: string;
  maxLength: number;
  onChange: (value: string) => void;
  onMediaInserted: (attachments: RichTextAttachment[]) => Promise<void>;
  onMediaUpload?: (files: File[]) => Promise<RichTextAttachment[]>;
  onRemoveMedia: (attachmentId: string) => void;
  placeholder: string;
}) {
  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      BlockquotePlugin,
      FontColorPlugin,
      LinkPlugin,
      ListPlugin,
    ],
    value: initialValue,
  });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || !onMediaUpload) return;

    setIsUploading(true);
    try {
      await onMediaInserted(await onMediaUpload(files));
    } finally {
      setIsUploading(false);
    }
  }

  function addLink() {
    const url = window.prompt("Paste a link (https://…)");
    if (!url?.trim()) return;
    upsertLink(editor, { url: url.trim() });
  }

  return (
    <Plate
      editor={editor}
      onChange={({ value: nextValue }) => {
        const html = serializePlateValue(nextValue as PlateNode[]);
        if (plainTextLength(html) <= maxLength) onChange(html);
      }}
    >
      <div
        aria-label="Text formatting"
        className={styles.toolbar}
        role="toolbar"
      >
        <ToolbarButton label="Bold" onMouseDown={() => editor.tf.bold.toggle()}>
          <Bold aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          onMouseDown={() => editor.tf.italic.toggle()}
        >
          <Italic aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          onMouseDown={() => editor.tf.underline.toggle()}
        >
          <Underline aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          onMouseDown={() => editor.tf.blockquote.toggle()}
        >
          <Quote aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Bulleted list"
          onMouseDown={() =>
            toggleList(editor, { listStyleType: ListStyleType.Disc })
          }
        >
          <List aria-hidden="true" size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          onMouseDown={() =>
            toggleList(editor, { listStyleType: ListStyleType.Decimal })
          }
        >
          <ListOrdered aria-hidden="true" size={16} />
        </ToolbarButton>
        <ToolbarButton label="Add link" onMouseDown={addLink}>
          <Link2 aria-hidden="true" size={15} />
        </ToolbarButton>
        <label className={styles.colorControl} title="Text color">
          <Palette aria-hidden="true" size={15} />
          <input
            aria-label="Text color"
            defaultValue="#1f2937"
            onChange={(event) => editor.tf.color.addMark(event.target.value)}
            type="color"
          />
        </label>
        {onMediaUpload ? (
          <>
            <ToolbarButton
              disabled={isUploading}
              label="Upload image"
              onMouseDown={() => imageInputRef.current?.click()}
            >
              <ImagePlus aria-hidden="true" size={16} />
            </ToolbarButton>
            <ToolbarButton
              disabled={isUploading}
              label="Upload video"
              onMouseDown={() => videoInputRef.current?.click()}
            >
              <Video aria-hidden="true" size={16} />
            </ToolbarButton>
            <input
              accept="image/jpeg,image/png,image/webp"
              className={styles.mediaInput}
              multiple
              onChange={(event) => void handleMediaChange(event)}
              ref={imageInputRef}
              type="file"
            />
            <input
              accept="video/mp4,video/webm"
              className={styles.mediaInput}
              multiple
              onChange={(event) => void handleMediaChange(event)}
              ref={videoInputRef}
              type="file"
            />
          </>
        ) : null}
      </div>
      <PlateContent
        aria-describedby={`${id}-hint`}
        aria-label={placeholder}
        className={styles.content}
        id={id}
        placeholder={placeholder}
      />
      <EmbeddedMediaGallery
        attachments={attachments}
        embeddedMedia={embeddedMedia}
        getAttachmentPreviewUrl={getAttachmentPreviewUrl}
        onRemove={onRemoveMedia}
      />
      <p className={styles.hint} id={`${id}-hint`}>
        {plainTextLength(serializePlateValue(editor.children as PlateNode[]))}/
        {maxLength}
      </p>
    </Plate>
  );
}

export function RichTextContent({
  attachments = [],
  getAttachmentPreviewUrl,
  value,
}: {
  attachments?: RichTextAttachment[];
  getAttachmentPreviewUrl?: (attachmentId: string) => string | undefined;
  value: string;
}) {
  return (
    <span
      className={styles.contentOutput}
      dangerouslySetInnerHTML={{
        __html: resolveEmbeddedMedia(
          normalizeHtml(value),
          attachments,
          getAttachmentPreviewUrl,
        ),
      }}
    />
  );
}

function EmbeddedMediaGallery({
  attachments,
  embeddedMedia,
  getAttachmentPreviewUrl,
  onRemove,
}: {
  attachments: RichTextAttachment[];
  embeddedMedia: EmbeddedMedia[];
  getAttachmentPreviewUrl?: (attachmentId: string) => string | undefined;
  onRemove: (attachmentId: string) => void;
}) {
  if (!embeddedMedia.length) return null;
  const attachmentsById = new Map(
    attachments.map((attachment) => [attachment.id, attachment]),
  );

  return (
    <div className={styles.embeddedMedia}>
      {embeddedMedia.map((media) => {
        const attachment = attachmentsById.get(media.attachmentId);
        const previewUrl = getAttachmentPreviewUrl?.(media.attachmentId);
        if (!attachment || !previewUrl) return null;

        return (
          <figure key={media.attachmentId}>
            {media.kind === "video" ? (
              <video controls preload="metadata">
                <source src={previewUrl} type={attachment.mimeType} />
              </video>
            ) : (
              // Attachment previews are authenticated API resources. A native img
              // keeps the existing session credentials on the asset request.
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={attachment.originalFilename} src={previewUrl} />
            )}
            <figcaption>
              <span>{attachment.originalFilename}</span>
              <button
                aria-label={`Remove ${attachment.originalFilename} from description`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onRemove(media.attachmentId)}
                title="Remove from description"
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function ToolbarButton({
  children,
  disabled,
  label,
  onMouseDown,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onMouseDown: () => void;
}) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown();
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function serializePlateValue(nodes: PlateNode[]) {
  let html = "";
  let listItems: { item: string; ordered: boolean }[] = [];
  function flushList() {
    if (!listItems.length) return;
    const tag = listItems[0]?.ordered ? "ol" : "ul";
    html += `<${tag}>${listItems.map(({ item }) => `<li>${item}</li>`).join("")}</${tag}>`;
    listItems = [];
  }
  for (const node of nodes) {
    const children = serializeNodeChildren(node.children ?? []);
    if (node.listStyleType) {
      const ordered = node.listStyleType === "decimal";
      if (listItems.length && listItems[0]?.ordered !== ordered) flushList();
      listItems.push({ item: children || "<br>", ordered });
      continue;
    }
    flushList();
    html +=
      node.type === "blockquote"
        ? `<blockquote>${children}</blockquote>`
        : `<p>${children || "<br>"}</p>`;
  }
  flushList();
  return html;
}

function serializeNodeChildren(nodes: PlateNode[]) {
  return nodes.map(serializeNode).join("");
}

function serializeNode(node: PlateNode): string {
  if (typeof node.text === "string") {
    let text = escapeHtml(node.text);
    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    if (isValidColor(node.color))
      text = `<span style="color:${node.color}">${text}</span>`;
    return text;
  }
  const children = serializeNodeChildren(node.children ?? []);
  if (node.type === "a" && node.url && isSafeLink(node.url)) {
    return `<a href="${escapeAttribute(node.url)}" rel="noopener noreferrer" target="_blank">${children}</a>`;
  }
  return children;
}

function normalizeHtml(value: string | null | undefined) {
  const source = value?.trim();
  if (!source) return "";
  if (
    /<\/?(?:a|blockquote|br|em|img|li|ol|p|span|strong|u|ul|video)\b/i.test(
      source,
    )
  )
    return source;
  return `<p>${escapeHtml(source).replace(/\n/g, "<br>")}</p>`;
}

function extractEmbeddedMedia(value: string): EmbeddedMedia[] {
  return Array.from(value.matchAll(embeddedMediaPattern)).flatMap(
    ([, tag, attachmentId]) =>
      tag && attachmentId
        ? [
            {
              attachmentId,
              kind: tag.toLowerCase() === "video" ? "video" : "image",
            },
          ]
        : [],
  );
}
function stripEmbeddedMedia(value: string) {
  return value.replace(embeddedMediaPattern, "");
}
function appendEmbeddedMedia(value: string, media: EmbeddedMedia[]) {
  const allMedia = [...extractEmbeddedMedia(value), ...media];
  const uniqueMedia = allMedia.filter(
    (item, index) =>
      allMedia.findIndex(
        (candidate) => candidate.attachmentId === item.attachmentId,
      ) === index,
  );
  const tags = uniqueMedia
    .map(({ attachmentId, kind }) =>
      kind === "video"
        ? `<video controls data-task-attachment-id="${attachmentId}"></video>`
        : `<img data-task-attachment-id="${attachmentId}" alt="">`,
    )
    .join("");
  return `${stripEmbeddedMedia(value).trim()}${tags}`;
}
export function removeEmbeddedMedia(value: string, attachmentId: string) {
  return value.replace(
    embeddedMediaPattern,
    (tag, _kind, currentAttachmentId) =>
      currentAttachmentId === attachmentId ? "" : tag,
  );
}

export function replaceEmbeddedMediaAttachment(
  value: string,
  currentAttachmentId: string,
  nextAttachmentId: string,
) {
  return value.replace(
    new RegExp(
      `(data-task-attachment-id=["'])${escapeRegExp(currentAttachmentId)}(["'])`,
      "g",
    ),
    `$1${nextAttachmentId}$2`,
  );
}
function resolveEmbeddedMedia(
  html: string,
  attachments: RichTextAttachment[],
  getAttachmentPreviewUrl?: (attachmentId: string) => string | undefined,
) {
  const attachmentsById = new Map(
    attachments.map((attachment) => [attachment.id, attachment]),
  );
  return html.replace(embeddedMediaPattern, (tag, kind, attachmentId) => {
    const attachment = attachmentsById.get(attachmentId);
    const previewUrl = getAttachmentPreviewUrl?.(attachmentId);
    if (!attachment || !previewUrl) return "";
    const safeUrl = escapeAttribute(previewUrl);
    const safeName = escapeAttribute(attachment.originalFilename);
    return kind.toLowerCase() === "video"
      ? `<video controls preload="metadata" data-description-media-id="${attachment.id}"><source src="${safeUrl}" type="${escapeAttribute(attachment.mimeType)}"></video>`
      : `<img src="${safeUrl}" alt="${safeName}" data-description-media-id="${attachment.id}">`;
  });
}
function plainTextLength(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim().length;
}
function hasContent(html: string) {
  return plainTextLength(html) > 0 || extractEmbeddedMedia(html).length > 0;
}
function isSupportedMedia(attachment: RichTextAttachment) {
  return (
    attachment.mimeType.startsWith("image/") ||
    attachment.mimeType.startsWith("video/")
  );
}
function isSafeLink(value: string | undefined) {
  return Boolean(value && /^(https?:\/\/|mailto:)/i.test(value));
}
function isValidColor(value: string | undefined) {
  return Boolean(
    value &&
    (/^#[0-9a-f]{3,8}$/i.test(value) ||
      /^rgb\((?:\d{1,3},\s*){2}\d{1,3}\)$/i.test(value)),
  );
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '"': "&quot;", "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;" })[
        character
      ] ?? character,
  );
}
function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

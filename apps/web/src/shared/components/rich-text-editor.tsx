"use client";

import {
  BlockquotePlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { Bold, Italic, Quote, Underline } from "lucide-react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { type ReactNode, useRef, useState } from "react";

import styles from "./rich-text-editor.module.css";

type RichTextEditorProps = {
  defaultValue?: string | null;
  form?: string;
  id: string;
  maxLength: number;
  name: string;
  placeholder: string;
  resetKey?: number;
};

type PlateNode = {
  bold?: boolean;
  children?: PlateNode[];
  italic?: boolean;
  text?: string;
  type?: string;
  underline?: boolean;
};

export function RichTextEditor({
  defaultValue,
  form,
  id,
  maxLength,
  name,
  placeholder,
  resetKey,
}: RichTextEditorProps) {
  const [value, setValue] = useState(() => normalizeHtml(defaultValue));
  const [isActive, setIsActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef(resetKey);

  if (resetRef.current !== resetKey) {
    resetRef.current = resetKey;
    setValue(normalizeHtml(defaultValue));
    setIsActive(false);
  }

  function closeIfFocusLeaves() {
    window.setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsActive(false);
      }
    }, 0);
  }

  return (
    <div className={styles.editor} onBlur={closeIfFocusLeaves} ref={containerRef}>
      <input form={form} name={name} type="hidden" value={value} />
      {isActive ? (
        <PlateEditorSurface
          id={id}
          initialValue={value}
          maxLength={maxLength}
          onChange={setValue}
          placeholder={placeholder}
        />
      ) : (
        <button
          aria-label={placeholder}
          className={styles.previewButton}
          onClick={() => setIsActive(true)}
          type="button"
        >
          {hasText(value) ? (
            <RichTextContent value={value} />
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </button>
      )}
    </div>
  );
}

function PlateEditorSurface({
  id,
  initialValue,
  maxLength,
  onChange,
  placeholder,
}: {
  id: string;
  initialValue: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const editor = usePlateEditor({
    plugins: [BoldPlugin, ItalicPlugin, UnderlinePlugin, BlockquotePlugin],
    value: initialValue,
  });

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        const html = serializePlateValue(value as PlateNode[]);
        if (plainTextLength(html) <= maxLength) onChange(html);
      }}
    >
      <div aria-label="Text formatting" className={styles.toolbar} role="toolbar">
        <ToolbarButton label="Bold" onMouseDown={() => editor.tf.bold.toggle()}>
          <Bold aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Italic" onMouseDown={() => editor.tf.italic.toggle()}>
          <Italic aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Underline" onMouseDown={() => editor.tf.underline.toggle()}>
          <Underline aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Quote" onMouseDown={() => editor.tf.blockquote.toggle()}>
          <Quote aria-hidden="true" size={15} />
        </ToolbarButton>
      </div>
      <PlateContent
        aria-describedby={`${id}-hint`}
        aria-label={placeholder}
        className={styles.content}
        id={id}
        placeholder={placeholder}
      />
      <p className={styles.hint} id={`${id}-hint`}>
        {plainTextLength(serializePlateValue(editor.children as PlateNode[]))}/{maxLength}
      </p>
    </Plate>
  );
}

export function RichTextContent({ value }: { value: string }) {
  return (
    <span
      className={styles.contentOutput}
      dangerouslySetInnerHTML={{ __html: normalizeHtml(value) }}
    />
  );
}

function ToolbarButton({
  children,
  label,
  onMouseDown,
}: {
  children: ReactNode;
  label: string;
  onMouseDown: () => void;
}) {
  return (
    <button
      aria-label={label}
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
  return nodes.map(serializeNode).join("");
}

function serializeNode(node: PlateNode): string {
  if (typeof node.text === "string") {
    let text = escapeHtml(node.text);
    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    return text;
  }

  const children = (node.children ?? []).map(serializeNode).join("");
  if (node.type === "blockquote") return `<blockquote>${children}</blockquote>`;
  return `<p>${children || "<br>"}</p>`;
}

function normalizeHtml(value: string | null | undefined) {
  const source = value?.trim();
  if (!source) return "";
  if (/<\/?(?:blockquote|br|em|p|strong|u)\b/i.test(source)) return source;
  return `<p>${escapeHtml(source).replace(/\n/g, "<br>")}</p>`;
}

function plainTextLength(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length;
}

function hasText(html: string) {
  return plainTextLength(html) > 0;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '"': "&quot;",
      "&": "&amp;",
      "'": "&#39;",
      "<": "&lt;",
      ">": "&gt;",
    };
    return entities[character] ?? character;
  });
}

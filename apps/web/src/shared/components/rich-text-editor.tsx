"use client";

import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

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

export function RichTextEditor({
  defaultValue,
  form,
  id,
  maxLength,
  name,
  placeholder,
  resetKey,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(() => toEditorHtml(defaultValue));

  useEffect(() => {
    const nextValue = toEditorHtml(defaultValue);
    setValue(nextValue);
    if (editorRef.current) editorRef.current.innerHTML = nextValue;
  }, [defaultValue, resetKey]);

  function syncValue() {
    const html = editorRef.current?.innerHTML ?? "";
    if (textLength(html) > maxLength) return;
    setValue(html);
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  function addLink() {
    const url = window.prompt("Paste a link");
    if (!url) return;
    try {
      const parsedUrl = new URL(url, window.location.origin);
      if (!['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) return;
      runCommand("createLink", parsedUrl.href);
    } catch {
      // Ignore malformed links: the server performs final HTML sanitisation.
    }
  }

  return (
    <div className={styles.editor}>
      <div aria-label="Text formatting" className={styles.toolbar} role="toolbar">
        <ToolbarButton label="Bold" onClick={() => runCommand("bold")}>
          <Bold aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => runCommand("italic")}>
          <Italic aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => runCommand("underline")}>
          <Underline aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Bullet list" onClick={() => runCommand("insertUnorderedList")}>
          <List aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => runCommand("insertOrderedList")}>
          <ListOrdered aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Quote" onClick={() => runCommand("formatBlock", "blockquote")}>
          <Quote aria-hidden="true" size={15} />
        </ToolbarButton>
        <ToolbarButton label="Add link" onClick={addLink}>
          <Link2 aria-hidden="true" size={15} />
        </ToolbarButton>
      </div>
      <div
        aria-describedby={`${id}-hint`}
        aria-label={placeholder}
        className={styles.content}
        contentEditable
        dangerouslySetInnerHTML={{ __html: value }}
        id={id}
        onInput={syncValue}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
      <input form={form} name={name} type="hidden" value={value} />
      <p className={styles.hint} id={`${id}-hint`}>
        {textLength(value)}/{maxLength}
      </p>
    </div>
  );
}

export function RichTextContent({ value }: { value: string }) {
  return (
    <div
      className={styles.contentOutput}
      dangerouslySetInnerHTML={{ __html: toEditorHtml(value) }}
    />
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button aria-label={label} onClick={onClick} title={label} type="button">
      {children}
    </button>
  );
}

function toEditorHtml(value: string | null | undefined) {
  const source = value?.trim();
  if (!source) return "";
  if (/<\/?(?:a|blockquote|br|code|em|li|ol|p|strong|u|ul)\b/i.test(source)) {
    return source;
  }
  return `<p>${escapeHtml(source).replace(/\n/g, "<br>")}</p>`;
}

function textLength(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length;
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

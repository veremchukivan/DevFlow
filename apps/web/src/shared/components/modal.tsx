"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import styles from "./modal.module.css";

type ModalProps = {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: "compact" | "default" | "wide";
};

export function Modal({
  children,
  isOpen,
  onClose,
  title,
  width = "default",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={`${styles.modal} ${styles[width]}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={() => {
        if (isOpen) onClose();
      }}
      ref={dialogRef}
    >
      <div className={styles.header}>
        <h2 id={titleId}>{title}</h2>
        <button
          aria-label={`Close ${title}`}
          className={styles.closeButton}
          onClick={onClose}
          title="Close"
          type="button"
        >
          <X aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>
      </div>
      <div className={styles.content}>{children}</div>
    </dialog>
  );
}

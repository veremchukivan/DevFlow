"use client";

import { CheckCircle2, FileText, Plus, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  confirmWorkspaceAgreement,
  createWorkspaceAgreement,
  getWorkspaceAgreements,
  updateWorkspaceAgreement,
} from "@/shared/lib/api-client";
import type { WorkspaceAgreement } from "@devflow/shared";
import styles from "./workspace-agreements.module.css";

const statuses = [
  "draft",
  "pending_confirmation",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export function WorkspaceAgreements() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [items, setItems] = useState<WorkspaceAgreement[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getWorkspaceAgreements(workspaceId)
      .then((result) => setItems(result.agreements))
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Unable to load agreements.",
        ),
      );
  }, [workspaceId]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    try {
      const result = await createWorkspaceAgreement(workspaceId, { title });
      setItems((current) => [result.agreement, ...current]);
      setTitle("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create agreement.",
      );
    }
  }

  async function change(
    item: WorkspaceAgreement,
    status: (typeof statuses)[number],
  ) {
    try {
      const result = await updateWorkspaceAgreement(workspaceId, item.id, {
        status,
      });
      setItems((current) =>
        current.map((value) =>
          value.id === item.id ? result.agreement : value,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update agreement.",
      );
    }
  }

  async function confirm(
    item: WorkspaceAgreement,
    confirmation: "confirmed" | "declined",
  ) {
    try {
      const result = await confirmWorkspaceAgreement(
        workspaceId,
        item.id,
        confirmation,
      );
      setItems((current) =>
        current.map((value) =>
          value.id === item.id ? result.agreement : value,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to confirm agreement.",
      );
    }
  }
  return (
    <main className={styles.page}>
      <header>
        <div>
          <span className={styles.icon}>
            <FileText size={20} />
          </span>
          <h1>Agreements</h1>
          <p>
            Turn decisions into explicit commitments, confirmations, and
            delivery follow-through.
          </p>
        </div>
        <form onSubmit={create}>
          <input
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New agreement"
            value={title}
          />
          <button type="submit">
            <Plus size={16} /> Create
          </button>
        </form>
      </header>
      {error ? <p className={styles.error}>{error}</p> : null}
      <section className={styles.list}>
        {items.length ? (
          items.map((item) => (
            <article key={item.id}>
              <div className={styles.top}>
                <div>
                  <span className={`${styles.status} ${styles[item.status]}`}>
                    {item.status.replaceAll("_", " ")}
                  </span>
                  <h2>{item.title}</h2>
                  {item.description ? <p>{item.description}</p> : null}
                </div>
                <select
                  aria-label={`Status for ${item.title}`}
                  onChange={(e) =>
                    void change(
                      item,
                      e.target.value as (typeof statuses)[number],
                    )
                  }
                  value={item.status}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <footer>
                <span>
                  <Users size={15} /> {item.participants.length} participants
                </span>
                {item.dueDate ? <span>Due {item.dueDate}</span> : null}
                <span>{item.taskIds.length} linked tasks</span>
                {item.status === "pending_confirmation" ? (
                  <div>
                    <button
                      onClick={() => void confirm(item, "confirmed")}
                      type="button"
                    >
                      <CheckCircle2 size={15} /> Confirm
                    </button>
                    <button
                      onClick={() => void confirm(item, "declined")}
                      type="button"
                    >
                      Decline
                    </button>
                  </div>
                ) : null}
              </footer>
            </article>
          ))
        ) : (
          <div className={styles.empty}>
            <FileText size={28} />
            <strong>No agreements yet</strong>
            <span>
              Create a written commitment after a call or planning decision.
            </span>
          </div>
        )}
      </section>
    </main>
  );
}

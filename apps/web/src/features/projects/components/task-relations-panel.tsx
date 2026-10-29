"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  createTaskRelation,
  deleteTaskRelation,
  getProjects,
  getTaskRelations,
  getTasks,
} from "@/shared/lib/api-client";
import type {
  Task,
  TaskRelation,
  TaskRelationType,
  WorkspaceRole,
} from "@devflow/shared";
import { can } from "@devflow/shared";

import styles from "./task-relations-panel.module.css";

export function TaskRelationsPanel({
  role,
  task,
  workspaceId,
}: {
  role: WorkspaceRole | undefined;
  task: Task;
  workspaceId: string;
}) {
  const [relations, setRelations] = useState<TaskRelation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingRelationId, setDeletingRelationId] = useState<string>();
  const [error, setError] = useState<string>();
  const canUpdateTask = role ? can(role, "task:update") : false;

  const loadRelations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getTaskRelations(
        workspaceId,
        task.projectId,
        task.id,
      );
      setRelations(response.relations);
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to load linked tasks."));
    } finally {
      setIsLoading(false);
    }
  }, [task.id, task.projectId, workspaceId]);

  useEffect(() => {
    void loadRelations();
  }, [loadRelations]);

  useEffect(() => {
    let active = true;
    void getProjects(workspaceId)
      .then(async ({ projects }) => {
        const responses = await Promise.all(
          projects.map((project) =>
            getTasks(workspaceId, project.id, {
              limit: 100,
              sortBy: "number",
              sortOrder: "asc",
            }),
          ),
        );
        if (active) setTasks(responses.flatMap((response) => response.tasks));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [workspaceId]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetTaskId = String(form.get("targetTaskId") ?? "");
    if (!targetTaskId) return;
    setIsSaving(true);
    try {
      await createTaskRelation(workspaceId, task.projectId, task.id, {
        relationType: form.get("relationType") as Exclude<
          TaskRelationType,
          "is_blocked_by"
        >,
        targetTaskId,
      });
      event.currentTarget.reset();
      await loadRelations();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to create task relation."));
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete(relationId: string) {
    setDeletingRelationId(relationId);
    try {
      await deleteTaskRelation(
        workspaceId,
        task.projectId,
        task.id,
        relationId,
      );
      await loadRelations();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to remove task relation."));
    } finally {
      setDeletingRelationId(undefined);
    }
  }

  return (
    <div className={styles.panel}>
      {canUpdateTask ? (
        <form
          className={styles.form}
          onSubmit={(event) => void onCreate(event)}
        >
          <select defaultValue="relates_to" name="relationType">
            <option value="blocks">Blocks</option>
            <option value="relates_to">Relates to</option>
            <option value="duplicates">Duplicates</option>
          </select>
          <select defaultValue="" name="targetTaskId" required>
            <option value="">Choose a task</option>
            {tasks
              .filter((candidate) => candidate.id !== task.id)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.key}: {candidate.title}
                </option>
              ))}
          </select>
          <button disabled={isSaving} type="submit">
            {isSaving ? "Linking…" : "Link"}
          </button>
        </form>
      ) : null}
      {isLoading ? <p className={styles.hint}>Loading linked tasks…</p> : null}
      {!isLoading && relations.length === 0 ? (
        <p className={styles.hint}>No linked work items yet.</p>
      ) : null}
      {relations.length ? (
        <ul className={styles.list}>
          {relations.map((relation) => (
            <li key={relation.id}>
              <span>{formatRelationType(relation.relationType)}</span>
              <Link
                href={`/workspaces/${workspaceId}/projects/${relation.task.projectId}?taskId=${relation.task.id}`}
              >
                <strong>{relation.task.key}</strong> {relation.task.title}
              </Link>
              {canUpdateTask ? (
                <button
                  aria-label={`Remove relation to ${relation.task.key}`}
                  disabled={deletingRelationId === relation.id}
                  onClick={() => void onDelete(relation.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function formatRelationType(value: string) {
  return value.replaceAll("_", " ");
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

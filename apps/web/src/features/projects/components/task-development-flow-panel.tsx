"use client";

import {
  Bot,
  CheckCircle2,
  CircleDot,
  GitBranch,
  Play,
  Save,
  Send,
  ShieldCheck,
  Workflow,
  XCircle,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiClientError,
  approveTaskDevelopmentPlan,
  approveTaskDevelopmentReview,
  createTaskDevelopmentFlow,
  createTaskDevelopmentFlowSession,
  createTaskGitBranch,
  createTaskPullRequest,
  getTaskDevelopmentFlow,
  getTaskGitLinks,
  rejectTaskDevelopmentPlan,
  rejectTaskDevelopmentReview,
  transitionTaskDevelopmentFlow,
  updateTaskDevelopmentFlow,
  syncTaskGitLinks,
} from "@/shared/lib/api-client";
import type { Task, TaskDevelopmentFlow, TaskDevelopmentFlowSession, TaskGitLink } from "@devflow/shared";

import styles from "./task-development-flow-panel.module.css";

const stages = [
  "idea",
  "planning",
  "approval",
  "ready",
  "in_progress",
  "review",
  "done",
] as const;

const labels: Record<(typeof stages)[number], string> = {
  idea: "Idea",
  planning: "Planning",
  approval: "Approval",
  ready: "Ready",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

export function TaskDevelopmentFlowPanel({
  canUpdate,
  task,
  workspaceId,
}: {
  canUpdate: boolean;
  task: Task;
  workspaceId: string;
}) {
  const [flow, setFlow] = useState<TaskDevelopmentFlow | null>();
  const [sessions, setSessions] = useState<TaskDevelopmentFlowSession[]>([]);
  const [gitLinks, setGitLinks] = useState<TaskGitLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getTaskDevelopmentFlow(
        workspaceId,
        task.projectId,
        task.id,
      );
      setFlow(response.flow);
      setSessions(response.sessions);
      const gitResponse = await getTaskGitLinks(workspaceId, task.projectId, task.id);
      setGitLinks(gitResponse.links);
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to load Development Flow."));
    } finally {
      setIsLoading(false);
    }
  }, [task.id, task.projectId, workspaceId]);

  useEffect(() => void load(), [load]);

  const currentStageIndex = flow ? stages.indexOf(flow.state) : 0;
  const activeSession = useMemo(
    () => sessions.find((session) => session.status === "active"),
    [sessions],
  );

  async function enableFlow() {
    setIsSaving(true);
    try {
      const response = await createTaskDevelopmentFlow(
        workspaceId,
        task.projectId,
        task.id,
        { acceptanceCriteria: [] },
      );
      setFlow(response.flow);
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to enable Development Flow."));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flow) return;
    const form = new FormData(event.currentTarget);
    const acceptanceCriteria = String(form.get("acceptanceCriteria") ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    setIsSaving(true);
    try {
      const response = await updateTaskDevelopmentFlow(
        workspaceId,
        task.projectId,
        task.id,
        {
          acceptanceCriteria,
          branchName: valueOrNull(form.get("branchName")),
          ciStatus: String(form.get("ciStatus")) as TaskDevelopmentFlow["ciStatus"],
          implementationPlan: valueOrNull(form.get("implementationPlan")),
          pullRequestUrl: valueOrNull(form.get("pullRequestUrl")),
          summary: valueOrNull(form.get("summary")),
          testInstructions: valueOrNull(form.get("testInstructions")),
        },
      );
      setFlow(response.flow);
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to save Development Flow."));
    } finally {
      setIsSaving(false);
    }
  }

  async function transition(state: (typeof stages)[number]) {
    setIsSaving(true);
    try {
      const response = await transitionTaskDevelopmentFlow(
        workspaceId,
        task.projectId,
        task.id,
        state,
      );
      setFlow(response.flow);
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to move Development Flow."));
    } finally {
      setIsSaving(false);
    }
  }

  async function decide(kind: "approve-plan" | "reject-plan" | "approve-review" | "reject-review") {
    if (!flow) return;
    const needsComment = kind.startsWith("reject");
    const comment = needsComment
      ? window.prompt("Describe what needs to change:")?.trim()
      : undefined;
    if (needsComment && !comment) return;
    setIsSaving(true);
    try {
      const response =
        kind === "approve-plan"
          ? await approveTaskDevelopmentPlan(workspaceId, task.projectId, task.id)
          : kind === "approve-review"
            ? await approveTaskDevelopmentReview(workspaceId, task.projectId, task.id)
            : kind === "reject-plan"
              ? await rejectTaskDevelopmentPlan(workspaceId, task.projectId, task.id, comment!)
              : await rejectTaskDevelopmentReview(workspaceId, task.projectId, task.id, comment!);
      setFlow(response.flow);
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to save the review decision."));
    } finally {
      setIsSaving(false);
    }
  }

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    try {
      await createTaskDevelopmentFlowSession(workspaceId, task.projectId, task.id, {
        agentName: valueOrNull(form.get("agentName")) ?? undefined,
        client: String(form.get("client")),
      });
      await load();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to start the agent session."));
    } finally {
      setIsSaving(false);
    }
  }

  async function createBranch() {
    const name = window.prompt("Branch name", `feature/task-${task.number}-${slug(task.title)}`)?.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await createTaskGitBranch(workspaceId, task.projectId, task.id, { name });
      await load();
    } catch (caughtError) { setError(messageFor(caughtError, "Unable to create branch.")); } finally { setIsSaving(false); }
  }

  async function createPullRequest() {
    setIsSaving(true);
    try {
      await createTaskPullRequest(workspaceId, task.projectId, task.id, {
        body: flow?.summary ?? "",
        title: `Task ${task.number}: ${task.title}`,
      });
      await load();
    } catch (caughtError) { setError(messageFor(caughtError, "Unable to create pull request.")); } finally { setIsSaving(false); }
  }

  async function syncGit() {
    setIsSaving(true);
    try {
      await syncTaskGitLinks(workspaceId, task.projectId, task.id);
      await load();
    } catch (caughtError) { setError(messageFor(caughtError, "Unable to synchronize Git activity.")); } finally { setIsSaving(false); }
  }

  return (
    <section className={styles.panel} aria-labelledby={`development-flow-${task.id}`}>
      <div className={styles.heading}>
        <div>
          <h3 id={`development-flow-${task.id}`}>
            <Workflow aria-hidden="true" size={18} /> Development Flow
          </h3>
          <p>Plan, approve, implement and review technical work.</p>
        </div>
        {flow ? <span className={styles.state}>{labels[flow.state]}</span> : null}
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {isLoading ? <p className={styles.empty}>Loading Development Flow…</p> : null}
      {!isLoading && !flow ? (
        <div className={styles.emptyState}>
          <div><ShieldCheck aria-hidden="true" size={20} /></div>
          <div>
            <strong>Use a controlled delivery process</strong>
            <p>Enable plan approval, agent sessions and review gates for this task.</p>
          </div>
          {canUpdate ? <button disabled={isSaving} onClick={() => void enableFlow()} type="button">Enable flow</button> : null}
        </div>
      ) : null}
      {flow ? (
        <>
          <ol className={styles.steps} aria-label="Development Flow progress">
            {stages.map((stage, index) => (
              <li className={index <= currentStageIndex ? styles.stepActive : undefined} key={stage}>
                {index < currentStageIndex ? <CheckCircle2 aria-hidden="true" size={15} /> : <CircleDot aria-hidden="true" size={15} />}
                <span>{labels[stage]}</span>
              </li>
            ))}
          </ol>
          <form className={styles.form} onSubmit={(event) => void saveDetails(event)}>
            <label className={styles.fullWidth}>
              <span>Acceptance criteria</span>
              <textarea defaultValue={flow.acceptanceCriteria.join("\n")} disabled={!canUpdate || isSaving} name="acceptanceCriteria" placeholder="One verifiable outcome per line" rows={4} />
            </label>
            <label className={styles.fullWidth}>
              <span>Implementation plan</span>
              <textarea defaultValue={flow.implementationPlan ?? ""} disabled={!canUpdate || isSaving} name="implementationPlan" placeholder="Describe the approach, affected areas and risks" rows={6} />
            </label>
            <label>
              <span><GitBranch aria-hidden="true" size={14} /> Branch</span>
              <input defaultValue={flow.branchName ?? ""} disabled={!canUpdate || isSaving} name="branchName" placeholder="feature/DF-123-short-name" />
            </label>
            <label>
              <span>Pull request URL</span>
              <input defaultValue={flow.pullRequestUrl ?? ""} disabled={!canUpdate || isSaving} name="pullRequestUrl" placeholder="https://github.com/.../pull/..." type="url" />
            </label>
            <label>
              <span>CI status</span>
              <select defaultValue={flow.ciStatus} disabled={!canUpdate || isSaving} name="ciStatus">
                <option value="not_configured">Not configured</option><option value="pending">Pending</option><option value="passing">Passing</option><option value="failing">Failing</option>
              </select>
            </label>
            <label className={styles.fullWidth}>
              <span>Test instructions</span>
              <textarea defaultValue={flow.testInstructions ?? ""} disabled={!canUpdate || isSaving} name="testInstructions" placeholder="How should a reviewer verify this change?" rows={3} />
            </label>
            <label className={styles.fullWidth}>
              <span>Implementation summary</span>
              <textarea defaultValue={flow.summary ?? ""} disabled={!canUpdate || isSaving} name="summary" placeholder="What changed, what was verified and what remains?" rows={3} />
            </label>
            {canUpdate ? <button className={styles.saveButton} disabled={isSaving} type="submit"><Save aria-hidden="true" size={15} /> Save flow details</button> : null}
          </form>
          {canUpdate ? <div className={styles.actions}>{flowAction(flow.state, isSaving, transition, decide)}</div> : null}
          <section className={styles.sessions} aria-label="Git delivery links">
            <div><h4><GitBranch aria-hidden="true" size={16} /> Repository delivery</h4><span>{gitLinks.length}</span></div>
            {canUpdate ? <div className={styles.actions}>
              {!flow.branchName ? <button disabled={isSaving} onClick={() => void createBranch()} type="button"><GitBranch aria-hidden="true" size={14} /> Create branch</button> : null}
              {flow.branchName && !flow.pullRequestUrl ? <button disabled={isSaving} onClick={() => void createPullRequest()} type="button"><Send aria-hidden="true" size={14} /> Create pull request</button> : null}
              <button disabled={isSaving} onClick={() => void syncGit()} type="button">Sync Git & CI</button>
            </div> : null}
            {gitLinks.length ? <ul>{gitLinks.map((link) => <li key={link.id}><a href={link.url} rel="noreferrer" target="_blank"><span>{link.type.replace("_", " ")}: {link.label}</span><small>{link.status ?? "linked"}</small></a></li>)}</ul> : <p className={styles.empty}>Connect a repository in project settings to create and synchronize delivery links.</p>}
          </section>
          {flow.state === "in_progress" ? (
            <section className={styles.sessions} aria-labelledby={`agent-sessions-${task.id}`}>
              <div><h4 id={`agent-sessions-${task.id}`}><Bot aria-hidden="true" size={16} /> AI agent sessions</h4><span>{sessions.length}</span></div>
              {!activeSession && canUpdate ? <form onSubmit={(event) => void startSession(event)}><select aria-label="AI client" defaultValue="Codex" name="client"><option>Codex</option><option>Claude Code</option><option>Cursor</option><option>Gemini CLI</option><option>Other</option></select><input name="agentName" placeholder="Agent name (optional)" /><button disabled={isSaving} type="submit"><Play aria-hidden="true" size={14} /> Start session</button></form> : null}
              {activeSession ? <p className={styles.activeSession}><Bot aria-hidden="true" size={14} /> {activeSession.agentName || activeSession.client} is working in this flow.</p> : null}
              {sessions.length ? <ul>{sessions.map((session) => <li key={session.id}><span>{session.agentName || session.client}</span><small>{session.client} · {session.status} · {new Date(session.startedAt).toLocaleString()}</small></li>)}</ul> : <p className={styles.empty}>No agent sessions yet.</p>}
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function flowAction(
  state: (typeof stages)[number],
  isSaving: boolean,
  transition: (state: (typeof stages)[number]) => Promise<void>,
  decide: (kind: "approve-plan" | "reject-plan" | "approve-review" | "reject-review") => Promise<void>,
) {
  if (state === "idea") return <button disabled={isSaving} onClick={() => void transition("planning")} type="button"><Play aria-hidden="true" size={15} /> Start planning</button>;
  if (state === "planning") return <button disabled={isSaving} onClick={() => void transition("approval")} type="button"><Send aria-hidden="true" size={15} /> Request plan approval</button>;
  if (state === "approval") return <><button disabled={isSaving} onClick={() => void decide("approve-plan")} type="button"><CheckCircle2 aria-hidden="true" size={15} /> Approve plan</button><button className={styles.rejectButton} disabled={isSaving} onClick={() => void decide("reject-plan")} type="button"><XCircle aria-hidden="true" size={15} /> Request changes</button></>;
  if (state === "ready") return <button disabled={isSaving} onClick={() => void transition("in_progress")} type="button"><Play aria-hidden="true" size={15} /> Start implementation</button>;
  if (state === "in_progress") return <button disabled={isSaving} onClick={() => void transition("review")} type="button"><Send aria-hidden="true" size={15} /> Send to review</button>;
  if (state === "review") return <><button disabled={isSaving} onClick={() => void decide("approve-review")} type="button"><CheckCircle2 aria-hidden="true" size={15} /> Approve and complete</button><button className={styles.rejectButton} disabled={isSaving} onClick={() => void decide("reject-review")} type="button"><XCircle aria-hidden="true" size={15} /> Request changes</button></>;
  return <p className={styles.completed}><CheckCircle2 aria-hidden="true" size={16} /> Review approved. This task can now move to Done.</p>;
}

function valueOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "work";
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

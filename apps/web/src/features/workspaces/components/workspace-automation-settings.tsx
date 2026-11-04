"use client";

import { useParams } from "next/navigation";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Activity, Boxes, ClipboardList, FileClock, Gauge, Plus, RotateCcw, Settings2, Sparkles, Trash2 } from "lucide-react";

import {
  ApiClientError,
  getWorkspace,
  getWorkspaceAutomationRules,
  getWorkspaceAutomationRuns,
  getWorkspaceAutomationTemplates,
  getWorkspaceAutomationUsage,
  getWorkspaceMembers,
  updateWorkspaceAutomationRule,
  createWorkspaceAutomationRule,
  deleteWorkspaceAutomationRule,
  retryWorkspaceAutomationRun,
} from "@/shared/lib/api-client";
import type {
  Workspace,
  WorkspaceAutomationRulesResponse,
  WorkspaceAutomationRunsResponse,
  WorkspaceMember,
} from "@devflow/shared";
import styles from "./workspace-automation-settings.module.css";

type Tab = "flows" | "audit" | "templates" | "usage";

const ruleCopy = {
  children_completed_close_parent: {
    description: "Complete the parent after all of its direct child work items are done.",
    title: "Close parent when all children are complete",
  },
  task_transition_assign: {
    description: "Assign a workspace member whenever a work item changes status.",
    title: "Automatically assign on transition",
  },
  parent_completed_close_children: {
    description: "Complete unfinished direct child work items when their parent is completed.",
    title: "Close children when the parent is complete",
  },
} as const;

export function WorkspaceAutomationSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [tab, setTab] = useState<Tab>("flows");
  const [workspace, setWorkspace] = useState<Workspace>();
  const [rules, setRules] = useState<WorkspaceAutomationRulesResponse["rules"]>([]);
  const [runs, setRuns] = useState<WorkspaceAutomationRunsResponse["runs"]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [templates, setTemplates] = useState<{ description: string; ruleType: string; title: string }[]>([]);
  const [usage, setUsage] = useState<{ enabledRules: number; failedRuns: number; successfulRuns: number; totalRules: number; totalRuns: number }>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [updatingRuleId, setUpdatingRuleId] = useState<string>();
  const [showBuilder, setShowBuilder] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getWorkspace(workspaceId),
      getWorkspaceAutomationRules(workspaceId),
      getWorkspaceAutomationRuns(workspaceId),
      getWorkspaceAutomationTemplates(workspaceId),
      getWorkspaceAutomationUsage(workspaceId),
      getWorkspaceMembers(workspaceId),
    ])
      .then(([workspaceResponse, rulesResponse, runsResponse, templatesResponse, usageResponse, membersResponse]) => {
        if (!active) return;
        setWorkspace(workspaceResponse.workspace);
        setRules(rulesResponse.rules);
        setRuns(runsResponse.runs);
        setTemplates(templatesResponse.templates);
        setUsage(usageResponse);
        setMembers(membersResponse.members.filter((member) => member.status === "active"));
      })
      .catch((caughtError: unknown) => {
        if (active) setError(caughtError instanceof ApiClientError ? caughtError.message : "Unable to load workspace automation.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [workspaceId]);

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);

  async function saveRule(ruleId: string, input: { configuration?: Record<string, unknown>; enabled?: boolean }) {
    setError(undefined);
    setUpdatingRuleId(ruleId);
    try {
      const response = await updateWorkspaceAutomationRule(workspaceId, ruleId, input);
      setRules((current) => current.map((rule) => rule.id === ruleId ? response.rule : rule));
      setUsage((current) => current ? { ...current, enabledRules: input.enabled === undefined ? current.enabledRules : rules.reduce((total, rule) => total + (rule.id === ruleId ? Number(input.enabled) : Number(rule.enabled)), 0) } : current);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "Unable to update automation flow.");
    } finally {
      setUpdatingRuleId(undefined);
    }
  }

  function onAssigneeChange(ruleId: string, event: ChangeEvent<HTMLSelectElement>) {
    const assigneeUserId = event.target.value;
    const rule = rules.find((candidate) => candidate.id === ruleId);
    if (!rule) return;
    const configuration = { ...rule.configuration };
    delete configuration.assigneeUserId;
    void saveRule(ruleId, {
      configuration: assigneeUserId
        ? { ...configuration, assigneeUserId }
        : configuration,
    });
  }

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get("action"));
    const actionValue = String(form.get("actionValue") ?? "").trim(); const titleValue = String(form.get("actionTitle") ?? "").trim();
    const actionInput = action === "assign" ? { type: "assign" as const, userId: actionValue } : action === "change_status" ? { type: "change_status" as const, statusId: actionValue } : action === "create_subtask" ? { type: "create_subtask" as const, title: titleValue } : action === "create_call" ? { type: "create_call" as const, title: titleValue || "Follow-up call", startsInHours: Number(form.get("startsInHours") ?? 24) } : action === "add_to_sprint" ? { type: "add_to_sprint" as const, sprintId: actionValue } : { type: "notify" as const, ...(actionValue ? { userId: actionValue } : {}) };
    setIsCreating(true); setError(undefined);
    try {
      const response = await createWorkspaceAutomationRule(workspaceId, { actions: [actionInput], conditions: { ...(form.get("taskType") ? { taskType: String(form.get("taskType")) as "task" | "bug" | "feature" | "story" | "epic" } : {}), ...(form.get("priority") ? { priority: String(form.get("priority")) as "low" | "medium" | "high" | "urgent" } : {}) }, enabled: true, name: String(form.get("name")).trim(), triggerType: String(form.get("triggerType")) as "task_created" | "task_status_changed" | "task_due" | "comment_created" | "pull_request_merged" });
      setRules((current) => [...current, response.rule]); setShowBuilder(false);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "Unable to create automation flow."); } finally { setIsCreating(false); }
  }

  async function removeRule(ruleId: string) { if (!window.confirm("Delete this automation flow?")) return; try { await deleteWorkspaceAutomationRule(workspaceId, ruleId); setRules((current) => current.filter((rule) => rule.id !== ruleId)); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "Unable to delete automation flow."); } }
  async function retryRun(ruleId: string, runId: string) { try { await retryWorkspaceAutomationRun(workspaceId, ruleId, runId); const next = await getWorkspaceAutomationRuns(workspaceId); setRuns(next.runs); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "Unable to retry automation flow."); } }

  if (loading) return <main className={styles.loading}>Loading automation</main>;

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <div className={styles.breadcrumb}>{workspace?.name ?? "Workspace"} / Settings / Automation</div>
        <header className={styles.header}>
          <div><h1>Automation</h1><p>Automate routine work in this workspace and review every run.</p></div>
          <div className={styles.headerActions}><div className={styles.headerStat}><Settings2 size={17} /> {activeRules} of {rules.length} flows enabled</div><button className={styles.createButton} onClick={() => setShowBuilder((current) => !current)} type="button"><Plus size={16} /> Create flow</button></div>
        </header>
        <nav className={styles.tabs} aria-label="Automation settings">
          {([ ["flows", "Flows", Activity], ["audit", "Audit log", FileClock], ["templates", "Templates", Boxes], ["usage", "Usage", Gauge] ] as const).map(([value, label, Icon]) => (
            <button className={tab === value ? styles.activeTab : ""} key={value} onClick={() => setTab(value)} type="button"><Icon size={16} />{label}</button>
          ))}
        </nav>
        {error ? <p className={styles.error}>{error}</p> : null}
        {tab === "flows" && showBuilder ? <Builder members={members} isCreating={isCreating} onCancel={() => setShowBuilder(false)} onSubmit={createRule} /> : null}
        {tab === "flows" ? <Flows rules={rules} members={members} updatingRuleId={updatingRuleId} onDelete={(ruleId) => void removeRule(ruleId)} onToggle={(ruleId, enabled) => void saveRule(ruleId, { enabled })} onAssigneeChange={onAssigneeChange} /> : null}
        {tab === "audit" ? <Audit runs={runs} onRetry={(ruleId, runId) => void retryRun(ruleId, runId)} /> : null}
        {tab === "templates" ? <Templates templates={templates} rules={rules} onEnable={(ruleId) => void saveRule(ruleId, { enabled: true })} /> : null}
        {tab === "usage" ? <Usage usage={usage} /> : null}
      </section>
    </main>
  );
}

function Flows({ rules, members, updatingRuleId, onDelete, onToggle, onAssigneeChange }: { rules: WorkspaceAutomationRulesResponse["rules"]; members: WorkspaceMember[]; updatingRuleId?: string; onDelete: (id: string) => void; onToggle: (id: string, enabled: boolean) => void; onAssigneeChange: (id: string, event: ChangeEvent<HTMLSelectElement>) => void }) {
  return <div className={styles.flowList}>{rules.map((rule) => {
    const copy = ruleCopy[rule.ruleType as keyof typeof ruleCopy];
    const configuredAssignee = typeof rule.configuration.assigneeUserId === "string" ? rule.configuration.assigneeUserId : "";
    const isCustom = rule.ruleType.startsWith("custom-"); const title = isCustom ? rule.name : copy.title; const description = isCustom ? `${triggerLabel(rule.triggerType)} · ${rule.actions.map(actionLabel).join(", ")}${rule.lastError ? ` · Error: ${rule.lastError}` : ""}` : copy.description;
    return <article className={styles.flowCard} key={rule.id}><div className={styles.flowIcon}><Activity size={19} /></div><div className={styles.flowBody}><h2>{title}</h2><p>{description}</p>{rule.ruleType === "task_transition_assign" ? <label className={styles.selectLabel}>Assign to<select disabled={!rule.enabled || updatingRuleId === rule.id} onChange={(event) => onAssigneeChange(rule.id, event)} value={configuredAssignee}><option value="">Choose a workspace member</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.user.displayName}</option>)}</select></label> : null}</div>{isCustom ? <button aria-label={`Delete ${title}`} className={styles.deleteButton} onClick={() => onDelete(rule.id)} type="button"><Trash2 size={16} /></button> : null}<label className={styles.switch}><input checked={rule.enabled} disabled={updatingRuleId === rule.id} onChange={(event) => onToggle(rule.id, event.target.checked)} type="checkbox" /><span /></label></article>;
  })}</div>;
}

function Audit({ runs, onRetry }: { runs: WorkspaceAutomationRunsResponse["runs"]; onRetry: (ruleId: string, runId: string) => void }) {
  if (!runs.length) return <Empty icon={<ClipboardList size={24} />} title="No automation activity yet" text="Flow runs will appear here as tasks change." />;
  return <div className={styles.table}><div className={styles.tableHeader}><span>When</span><span>Result</span><span>Summary</span></div>{runs.map((run) => <div className={styles.tableRow} key={run.id}><time>{new Date(run.createdAt).toLocaleString()}</time><span className={`${styles.outcome} ${styles[run.outcome]}`}>{run.outcome}</span><span>{run.summary}{run.outcome === "failed" ? <button className={styles.retryButton} onClick={() => onRetry(run.ruleId, run.id)} type="button"><RotateCcw size={14} /> Retry</button> : null}</span></div>)}</div>;
}

function Builder({ members, isCreating, onCancel, onSubmit }: { members: WorkspaceMember[]; isCreating: boolean; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <form className={styles.builder} onSubmit={onSubmit}><h2>New automation flow</h2><div className={styles.builderGrid}><label>Name<input name="name" placeholder="Assign new bugs" required /></label><label>Trigger<select defaultValue="task_created" name="triggerType"><option value="task_created">Task created</option><option value="task_status_changed">Status changed</option><option value="comment_created">Comment created</option><option value="task_due">Due date reached</option><option value="pull_request_merged">Pull request merged</option></select></label><label>When type<select name="taskType"><option value="">Any type</option>{["task", "bug", "feature", "story", "epic"].map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>When priority<select name="priority"><option value="">Any priority</option>{["low", "medium", "high", "urgent"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><label>Action<select defaultValue="assign" name="action"><option value="assign">Assign person</option><option value="notify">Send notification</option><option value="create_subtask">Create subtask</option><option value="create_call">Create call</option></select></label><label>Action value<select name="actionValue"><option value="">Choose member</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.user.displayName}</option>)}</select></label><label>Title<input name="actionTitle" placeholder="Subtask or call title" /></label><label>Call starts in hours<input defaultValue="24" min="0" name="startsInHours" type="number" /></label></div><div className={styles.builderActions}><button className={styles.secondaryButton} onClick={onCancel} type="button">Cancel</button><button className={styles.createButton} disabled={isCreating} type="submit">{isCreating ? "Creating…" : "Create flow"}</button></div></form>; }
function triggerLabel(trigger: string) { return ({ task_created: "When task is created", task_status_changed: "When status changes", task_due: "When due date is reached", comment_created: "When comment is created", pull_request_merged: "When PR is merged" } as Record<string, string>)[trigger] ?? trigger; }
function actionLabel(action: { type: string }) { return ({ assign: "assign", change_status: "change status", create_subtask: "create subtask", notify: "notify", create_call: "create call", add_to_sprint: "add to sprint" } as Record<string, string>)[action.type] ?? action.type; }

function Templates({ templates, rules, onEnable }: { templates: { description: string; ruleType: string; title: string }[]; rules: WorkspaceAutomationRulesResponse["rules"]; onEnable: (id: string) => void }) {
  return <div className={styles.templateGrid}>{templates.map((template) => { const rule = rules.find((candidate) => candidate.ruleType === template.ruleType); return <article className={styles.templateCard} key={template.ruleType}><Sparkles size={21} /><h2>{template.title}</h2><p>{template.description}</p><button className={styles.secondaryButton} disabled={!rule || rule.enabled} onClick={() => rule && onEnable(rule.id)} type="button">{rule?.enabled ? "Enabled" : "Enable flow"}</button></article>; })}</div>;
}

function Usage({ usage }: { usage?: { enabledRules: number; failedRuns: number; successfulRuns: number; totalRules: number; totalRuns: number } }) {
  return <div className={styles.usageGrid}><Metric label="Enabled flows" value={`${usage?.enabledRules ?? 0} / ${usage?.totalRules ?? 0}`} /><Metric label="Runs in last 30 days" value={String(usage?.totalRuns ?? 0)} /><Metric label="Successful runs" value={String(usage?.successfulRuns ?? 0)} /><Metric label="Failed runs" value={String(usage?.failedRuns ?? 0)} /></div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <article className={styles.metric}><span>{label}</span><strong>{value}</strong></article>; }
function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className={styles.empty}>{icon}<h2>{title}</h2><p>{text}</p></div>; }

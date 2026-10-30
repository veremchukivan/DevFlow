"use client";

import { useParams } from "next/navigation";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Activity, Boxes, ClipboardList, FileClock, Gauge, Settings2, Sparkles } from "lucide-react";

import {
  ApiClientError,
  getWorkspace,
  getWorkspaceAutomationRules,
  getWorkspaceAutomationRuns,
  getWorkspaceAutomationTemplates,
  getWorkspaceAutomationUsage,
  getWorkspaceMembers,
  updateWorkspaceAutomationRule,
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
  const [templates, setTemplates] = useState<{ description: string; ruleType: keyof typeof ruleCopy; title: string }[]>([]);
  const [usage, setUsage] = useState<{ enabledRules: number; failedRuns: number; successfulRuns: number; totalRules: number; totalRuns: number }>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [updatingRuleId, setUpdatingRuleId] = useState<string>();

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

  if (loading) return <main className={styles.loading}>Loading automation</main>;

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <div className={styles.breadcrumb}>{workspace?.name ?? "Workspace"} / Settings / Automation</div>
        <header className={styles.header}>
          <div><h1>Automation</h1><p>Automate routine work in this workspace and review every run.</p></div>
          <div className={styles.headerStat}><Settings2 size={17} /> {activeRules} of {rules.length} flows enabled</div>
        </header>
        <nav className={styles.tabs} aria-label="Automation settings">
          {([ ["flows", "Flows", Activity], ["audit", "Audit log", FileClock], ["templates", "Templates", Boxes], ["usage", "Usage", Gauge] ] as const).map(([value, label, Icon]) => (
            <button className={tab === value ? styles.activeTab : ""} key={value} onClick={() => setTab(value)} type="button"><Icon size={16} />{label}</button>
          ))}
        </nav>
        {error ? <p className={styles.error}>{error}</p> : null}
        {tab === "flows" ? <Flows rules={rules} members={members} updatingRuleId={updatingRuleId} onToggle={(ruleId, enabled) => void saveRule(ruleId, { enabled })} onAssigneeChange={onAssigneeChange} /> : null}
        {tab === "audit" ? <Audit runs={runs} /> : null}
        {tab === "templates" ? <Templates templates={templates} rules={rules} onEnable={(ruleId) => void saveRule(ruleId, { enabled: true })} /> : null}
        {tab === "usage" ? <Usage usage={usage} /> : null}
      </section>
    </main>
  );
}

function Flows({ rules, members, updatingRuleId, onToggle, onAssigneeChange }: { rules: WorkspaceAutomationRulesResponse["rules"]; members: WorkspaceMember[]; updatingRuleId?: string; onToggle: (id: string, enabled: boolean) => void; onAssigneeChange: (id: string, event: ChangeEvent<HTMLSelectElement>) => void }) {
  return <div className={styles.flowList}>{rules.map((rule) => {
    const copy = ruleCopy[rule.ruleType];
    const configuredAssignee = typeof rule.configuration.assigneeUserId === "string" ? rule.configuration.assigneeUserId : "";
    return <article className={styles.flowCard} key={rule.id}><div className={styles.flowIcon}><Activity size={19} /></div><div className={styles.flowBody}><h2>{copy.title}</h2><p>{copy.description}</p>{rule.ruleType === "task_transition_assign" ? <label className={styles.selectLabel}>Assign to<select disabled={!rule.enabled || updatingRuleId === rule.id} onChange={(event) => onAssigneeChange(rule.id, event)} value={configuredAssignee}><option value="">Choose a workspace member</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.user.displayName}</option>)}</select></label> : null}</div><label className={styles.switch}><input checked={rule.enabled} disabled={updatingRuleId === rule.id} onChange={(event) => onToggle(rule.id, event.target.checked)} type="checkbox" /><span /></label></article>;
  })}</div>;
}

function Audit({ runs }: { runs: WorkspaceAutomationRunsResponse["runs"] }) {
  if (!runs.length) return <Empty icon={<ClipboardList size={24} />} title="No automation activity yet" text="Flow runs will appear here as tasks change." />;
  return <div className={styles.table}><div className={styles.tableHeader}><span>When</span><span>Result</span><span>Summary</span></div>{runs.map((run) => <div className={styles.tableRow} key={run.id}><time>{new Date(run.createdAt).toLocaleString()}</time><span className={`${styles.outcome} ${styles[run.outcome]}`}>{run.outcome}</span><span>{run.summary}</span></div>)}</div>;
}

function Templates({ templates, rules, onEnable }: { templates: { description: string; ruleType: keyof typeof ruleCopy; title: string }[]; rules: WorkspaceAutomationRulesResponse["rules"]; onEnable: (id: string) => void }) {
  return <div className={styles.templateGrid}>{templates.map((template) => { const rule = rules.find((candidate) => candidate.ruleType === template.ruleType); return <article className={styles.templateCard} key={template.ruleType}><Sparkles size={21} /><h2>{template.title}</h2><p>{template.description}</p><button className={styles.secondaryButton} disabled={!rule || rule.enabled} onClick={() => rule && onEnable(rule.id)} type="button">{rule?.enabled ? "Enabled" : "Enable flow"}</button></article>; })}</div>;
}

function Usage({ usage }: { usage?: { enabledRules: number; failedRuns: number; successfulRuns: number; totalRules: number; totalRuns: number } }) {
  return <div className={styles.usageGrid}><Metric label="Enabled flows" value={`${usage?.enabledRules ?? 0} / ${usage?.totalRules ?? 0}`} /><Metric label="Runs in last 30 days" value={String(usage?.totalRuns ?? 0)} /><Metric label="Successful runs" value={String(usage?.successfulRuns ?? 0)} /><Metric label="Failed runs" value={String(usage?.failedRuns ?? 0)} /></div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <article className={styles.metric}><span>{label}</span><strong>{value}</strong></article>; }
function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className={styles.empty}>{icon}<h2>{title}</h2><p>{text}</p></div>; }

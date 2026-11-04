"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, ChevronLeft, ExternalLink, FileText, Lightbulb, Link2, Plus, Save, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectKnowledgeEntry } from "@devflow/shared";

import { ApiClientError, addProjectKnowledgeLink, createProjectKnowledgeEntry, deleteProjectKnowledgeEntry, getProjectKnowledge, updateProjectKnowledgeEntry } from "@/shared/lib/api-client";
import styles from "./project-knowledge-base.module.css";

type Kind = ProjectKnowledgeEntry["kind"];
type Status = ProjectKnowledgeEntry["status"];
const kindMeta: Record<Kind, { label: string; icon: typeof BookOpen; description: string }> = {
  adr: { label: "ADR", icon: ShieldCheck, description: "A recorded architecture decision" },
  pattern: { label: "Pattern", icon: Lightbulb, description: "A reusable implementation approach" },
  runbook: { label: "Runbook", icon: Wrench, description: "A repeatable operational procedure" },
  guideline: { label: "Guideline", icon: BookOpen, description: "A project rule or convention" },
  note: { label: "Technical note", icon: FileText, description: "Context worth preserving" },
};
const statusLabel: Record<Status, string> = { draft: "Draft", accepted: "Accepted", superseded: "Superseded", deprecated: "Deprecated" };
const emptyEntry = (): Pick<ProjectKnowledgeEntry, "kind" | "status" | "title" | "summary" | "content" | "tags"> => ({ kind: "note", status: "draft", title: "", summary: "", content: "", tags: [] });

export function ProjectKnowledgeBase() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const workspaceId = params.workspaceId;
  const projectId = params.projectId;
  const [entries, setEntries] = useState<ProjectKnowledgeEntry[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [draft, setDraft] = useState(emptyEntry());
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [linkForm, setLinkForm] = useState({ kind: "external" as const, label: "", url: "" });

  const active = entries.find((entry) => entry.id === activeId);
  const visibleEntries = useMemo(() => entries.filter((entry) => (kind === "all" || entry.kind === kind) && (status === "all" || entry.status === status) && `${entry.title} ${entry.summary ?? ""} ${entry.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [entries, kind, query, status]);

  const load = useCallback(async () => { setIsLoading(true); try { const response = await getProjectKnowledge(workspaceId, projectId); setEntries(response.entries); setActiveId((current) => current && response.entries.some((entry) => entry.id === current) ? current : response.entries[0]?.id); } catch (caught) { setError(message(caught, "Unable to load the knowledge base.")); } finally { setIsLoading(false); } }, [projectId, workspaceId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (active) setDraft({ kind: active.kind, status: active.status, title: active.title, summary: active.summary ?? "", content: active.content, tags: active.tags }); }, [active]);

  function createNew() { setActiveId(undefined); setDraft(emptyEntry()); setError(undefined); }
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setIsSaving(true); setError(undefined); try { const input = { ...draft, summary: draft.summary?.trim() || null, tags: draft.tags }; const response = active ? await updateProjectKnowledgeEntry(workspaceId, projectId, active.id, input) : await createProjectKnowledgeEntry(workspaceId, projectId, input); setEntries((current) => active ? current.map((entry) => entry.id === response.entry.id ? response.entry : entry) : [response.entry, ...current]); setActiveId(response.entry.id); } catch (caught) { setError(message(caught, "Unable to save this knowledge entry.")); } finally { setIsSaving(false); } }
  async function remove() { if (!active || !window.confirm(`Delete “${active.title}”?`)) return; setIsSaving(true); try { await deleteProjectKnowledgeEntry(workspaceId, projectId, active.id); setEntries((current) => current.filter((entry) => entry.id !== active.id)); setActiveId(undefined); setDraft(emptyEntry()); } catch (caught) { setError(message(caught, "Unable to delete this knowledge entry.")); } finally { setIsSaving(false); } }
  async function addLink(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!active) return; setIsSaving(true); try { const response = await addProjectKnowledgeLink(workspaceId, projectId, active.id, linkForm); setEntries((current) => current.map((entry) => entry.id === response.entry.id ? response.entry : entry)); setLinkForm({ kind: "external", label: "", url: "" }); } catch (caught) { setError(message(caught, "Unable to add the reference.")); } finally { setIsSaving(false); } }

  return <main className={styles.page}>
    <Link className={styles.back} href={`/workspaces/${workspaceId}/projects/${projectId}`}><ChevronLeft size={17} /> Back to project</Link>
    <header className={styles.header}><div><p>Project knowledge</p><h1>Knowledge Base</h1><span>Decisions and practices that give people and AI agents reliable project context.</span></div><button className={styles.primary} onClick={createNew} type="button"><Plus size={17} /> New entry</button></header>
    <div className={styles.layout}>
      <aside className={styles.catalogue}><div className={styles.filters}><input aria-label="Search knowledge" onChange={(event) => setQuery(event.target.value)} placeholder="Search knowledge" value={query} /><div><select aria-label="Filter by type" onChange={(event) => setKind(event.target.value as Kind | "all")} value={kind}><option value="all">All types</option>{Object.entries(kindMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select><select aria-label="Filter by status" onChange={(event) => setStatus(event.target.value as Status | "all")} value={status}><option value="all">All statuses</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
        {isLoading ? <p className={styles.hint}>Loading knowledge…</p> : visibleEntries.length ? <div className={styles.entryList}>{visibleEntries.map((entry) => { const Icon = kindMeta[entry.kind].icon; return <button className={`${styles.entry} ${entry.id === activeId ? styles.entryActive : ""}`} key={entry.id} onClick={() => setActiveId(entry.id)} type="button"><Icon size={16} /><span><strong>{entry.title}</strong><small>{kindMeta[entry.kind].label} · {statusLabel[entry.status]}</small></span></button>; })}</div> : <div className={styles.empty}><BookOpen size={24} /><strong>No matching knowledge</strong><span>Capture the decision before it gets lost in chat.</span></div>}</aside>
      <section className={styles.editor}><form onSubmit={save}><div className={styles.editorTop}><div><select aria-label="Knowledge type" onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as Kind }))} value={draft.kind}>{Object.entries(kindMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select><select aria-label="Knowledge status" onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Status }))} value={draft.status}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{active ? <button className={styles.delete} disabled={isSaving} onClick={remove} type="button"><Trash2 size={16} /> Delete</button> : null}</div>
        <label className={styles.title}><span>Title</span><input onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Describe the decision, pattern or instruction" required value={draft.title} /></label>
        <p className={styles.kindHint}>{kindMeta[draft.kind].description}</p>
        <label><span>Summary</span><input onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="One sentence an agent can understand quickly" value={draft.summary ?? ""} /></label>
        <label className={styles.content}><span>Details</span><textarea onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} placeholder="Context, constraints, alternatives, commands and recovery steps…" value={draft.content} /></label>
        <label><span>Tags</span><input onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} placeholder="api, security, architecture" value={draft.tags.join(", ")} /></label>
        {error ? <p className={styles.error}>{error}</p> : null}<div className={styles.saveRow}><button className={styles.primary} disabled={isSaving} type="submit"><Save size={16} /> {isSaving ? "Saving…" : "Save knowledge"}</button><span>{active ? `Updated ${new Date(active.updatedAt).toLocaleDateString()}` : "New entries start as drafts by default."}</span></div>
      </form>
      {active ? <section className={styles.references}><div><h2>References</h2><p>Connect the knowledge to delivery work and source material.</p></div>{active.links.length ? <ul>{active.links.map((link) => <li key={link.id}><Link2 size={15} /><a href={link.url} rel="noreferrer" target="_blank">{link.label} <ExternalLink size={13} /></a><em>{link.kind.replace("_", " ")}</em></li>)}</ul> : <p className={styles.hint}>No references yet.</p>}<form className={styles.linkForm} onSubmit={addLink}><select aria-label="Reference type" onChange={(event) => setLinkForm((current) => ({ ...current, kind: event.target.value as typeof current.kind }))} value={linkForm.kind}><option value="task">Task</option><option value="pull_request">Pull request</option><option value="figma">Figma</option><option value="release">Release</option><option value="external">External link</option></select><input onChange={(event) => setLinkForm((current) => ({ ...current, label: event.target.value }))} placeholder="Reference label" required value={linkForm.label} /><input onChange={(event) => setLinkForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://…" required type="url" value={linkForm.url} /><button className={styles.secondary} disabled={isSaving} type="submit"><Plus size={15} /> Add reference</button></form></section> : null}</section>
    </div>
  </main>;
}

function message(error: unknown, fallback: string) { return error instanceof ApiClientError ? error.message : fallback; }

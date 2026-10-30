"use client";

import { Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { createWorkspaceSavedFilter, deleteWorkspaceSavedFilter, getWorkspaceSavedFilters, getWorkspaceSettings, updateWorkspaceSettings } from "@/shared/lib/api-client";
import styles from "./workspace-settings-pages.module.css";

const types = ["task", "bug", "feature", "story"] as const;
const featureCopy = { attachments: "Attachments", automation: "Automation", sprints: "Sprints" } as const;

export function WorkspaceSettingsConfiguration({ section }: { section: "fields" | "work-types" | "features" | "filters" }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getWorkspaceSettings>>["settings"]>();
  const [filters, setFilters] = useState<Awaited<ReturnType<typeof getWorkspaceSavedFilters>>["filters"]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => { void getWorkspaceSettings(workspaceId).then((value) => setSettings(value.settings)).catch(() => setError("Unable to load workspace settings.")); if (section === "filters") void getWorkspaceSavedFilters(workspaceId).then((value) => setFilters(value.filters)); }, [section, workspaceId]);
  async function save(input: Parameters<typeof updateWorkspaceSettings>[1]) { try { const value = await updateWorkspaceSettings(workspaceId, input); setSettings(value.settings); } catch { setError("Unable to save workspace settings."); } }
  if (section === "filters") return <><Header title="Custom filters" text="Save reusable task filters for this workspace." />{error ? <p className={styles.error}>{error}</p> : null}<form className={styles.inlineForm} onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); void createWorkspaceSavedFilter(workspaceId, { name: String(form.get("name")), criteria: {} }).then((value) => { setFilters((current) => [value.filter, ...current]); event.currentTarget.reset(); }).catch(() => setError("Unable to save filter.")); }}><input name="name" placeholder="Filter name" required /><button type="submit"><Plus size={16}/>Save filter</button></form><div className={styles.itemList}>{filters.map((filter) => <div key={filter.id}><span>{filter.name}</span><button onClick={() => void deleteWorkspaceSavedFilter(workspaceId, filter.id).then(() => setFilters((items) => items.filter((item) => item.id !== filter.id))).catch(() => setError("Unable to remove filter."))} type="button"><Trash2 size={16}/></button></div>)}</div></>;
  if (!settings) return <p className={styles.loading}>Loading settings</p>;
  if (section === "work-types") return <><Header title="Work types" text="Choose which built-in work types can be used in this workspace." /><div className={styles.itemList}>{types.map((type) => <label key={type}><span>{type.slice(0, 1).toUpperCase() + type.slice(1)}</span><input checked={settings.enabledTaskTypes.includes(type)} onChange={() => { const enabledTaskTypes = settings.enabledTaskTypes.includes(type) ? settings.enabledTaskTypes.filter((value) => value !== type) : [...settings.enabledTaskTypes, type]; if (enabledTaskTypes.length) void save({ enabledTaskTypes }); }} type="checkbox" /></label>)}</div></>;
  if (section === "features") return <><Header title="Features" text="Enable workspace capabilities for all projects." /><div className={styles.itemList}>{(Object.keys(featureCopy) as Array<keyof typeof featureCopy>).map((key) => <label key={key}><span>{featureCopy[key]}</span><input checked={settings.features[key]} onChange={() => void save({ features: { ...settings.features, [key]: !settings.features[key] } })} type="checkbox" /></label>)}</div></>;
  return <><Header title="Fields" text="Create definitions for custom task information in this workspace." /><form className={styles.inlineForm} onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("name")).trim(); if (!name) return; void save({ customFields: [...settings.customFields, { id: crypto.randomUUID(), name, type: "text" }] }); event.currentTarget.reset(); }}><input name="name" placeholder="Field name" required /><button type="submit"><Plus size={16}/>Add field</button></form><div className={styles.itemList}>{settings.customFields.map((field) => <div key={field.id}><span>{field.name} <small>{field.type}</small></span><button onClick={() => void save({ customFields: settings.customFields.filter((item) => item.id !== field.id) })} type="button"><Trash2 size={16}/></button></div>)}</div></>;
}
function Header({ text, title }: { text: string; title: string }) { return <header className={styles.header}><p>Workspace settings</p><h1>{title}</h1><span>{text}</span></header>; }

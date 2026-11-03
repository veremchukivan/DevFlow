"use client";

import { GitBranch, Link2, ServerCog, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  connectProjectRepository,
  getGitConnections,
  getProjectRepository,
  getProjectReleaseNotes,
  removeProjectRepository,
  startGitConnection,
} from "@/shared/lib/api-client";
import type { GitConnection, ProjectRepository } from "@devflow/shared";

import styles from "@/shared/styles/ui.module.css";

export function ProjectRepositorySettings({ canUpdate, projectId, workspaceId }: { canUpdate: boolean; projectId: string; workspaceId: string }) {
  const [connections, setConnections] = useState<GitConnection[]>([]);
  const [configured, setConfigured] = useState({ github: false, gitlab: false });
  const [repository, setRepository] = useState<ProjectRepository | null>();
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [connectionsResponse, repositoryResponse] = await Promise.all([getGitConnections(), getProjectRepository(workspaceId, projectId)]);
      setConnections(connectionsResponse.connections); setConfigured(connectionsResponse.configured); setRepository(repositoryResponse.repository); setError(undefined);
    } catch (caught) { setError(messageFor(caught, "Unable to load repository integration.")); }
  }, [projectId, workspaceId]);
  useEffect(() => { void load(); }, [load]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const connectionId = String(form.get("connectionId") ?? ""); const fullName = String(form.get("fullName") ?? "").trim();
    if (!connectionId || !fullName) return; setIsSaving(true);
    try { const result = await connectProjectRepository(workspaceId, projectId, { connectionId, fullName }); setRepository(result.repository); setError(undefined); }
    catch (caught) { setError(messageFor(caught, "Unable to connect repository.")); } finally { setIsSaving(false); }
  }
  async function disconnect() { setIsSaving(true); try { await removeProjectRepository(workspaceId, projectId); setRepository(null); } catch (caught) { setError(messageFor(caught, "Unable to disconnect repository.")); } finally { setIsSaving(false); } }
  async function generateReleaseNotes() { setIsSaving(true); try { const result = await getProjectReleaseNotes(workspaceId, projectId); setReleaseNotes(result.markdown); } catch (caught) { setError(messageFor(caught, "Unable to generate release notes.")); } finally { setIsSaving(false); } }

  return <section className={styles.workspaceSection}>
    <div className={styles.sectionHeading}><div><h2>Source repository</h2><p>Connect GitHub or GitLab so tasks can create branches, pull requests and CI links.</p></div></div>
    {error ? <p className={styles.formError} role="alert">{error}</p> : null}
    {repository ? <><div className={styles.sessionList}><div><a href={repository.webUrl} rel="noreferrer" target="_blank"><strong><GitBranch aria-hidden="true" size={15} /> {repository.fullName}</strong><span>{repository.provider} · default branch: {repository.defaultBranch}</span></a></div>{canUpdate ? <button className={styles.textButton} disabled={isSaving} onClick={() => void disconnect()} type="button"><Trash2 aria-hidden="true" size={15} /> Disconnect</button> : null}</div><div className={styles.formActions}><button className={styles.secondaryButton} disabled={isSaving} onClick={() => void generateReleaseNotes()} type="button">Generate release notes</button></div>{releaseNotes ? <textarea aria-label="Generated release notes" className={styles.taskDescriptionField} readOnly rows={5} value={releaseNotes} /> : null}</> : null}
    {!repository && canUpdate ? <>
      {connections.length ? <form className={styles.taskForm} onSubmit={(event) => void onSubmit(event)}><label><span>Connected account</span><select defaultValue="" name="connectionId" required><option disabled value="">Choose an account</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.provider === "github" ? "GitHub" : "GitLab"}: {connection.username}</option>)}</select></label><label><span>Repository</span><input name="fullName" placeholder="owner/repository or group/project" required /></label><div className={styles.formActions}><button className={styles.secondaryButton} disabled={isSaving} type="submit"><Link2 aria-hidden="true" size={15} /> {isSaving ? "Connecting…" : "Connect repository"}</button></div></form> : <div className={styles.emptyState}><ServerCog aria-hidden="true" size={20} /><div><strong>Connect a Git provider first</strong><p>Tokens stay encrypted on the server and are never returned to the browser.</p></div></div>}
      <div className={styles.formActions}>{configured.github ? <button className={styles.secondaryButton} onClick={() => startGitConnection("github")} type="button"><ServerCog aria-hidden="true" size={15} /> Connect GitHub</button> : null}{configured.gitlab ? <button className={styles.secondaryButton} onClick={() => startGitConnection("gitlab")} type="button">Connect GitLab</button> : null}{!configured.github && !configured.gitlab ? <p className={styles.mutedCopy}>An administrator must add GitHub or GitLab OAuth credentials to the API environment before accounts can be connected.</p> : null}</div>
    </> : null}
  </section>;
}
function messageFor(error: unknown, fallback: string) { return error instanceof ApiClientError ? error.message : fallback; }

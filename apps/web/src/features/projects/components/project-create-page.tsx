"use client";

import { ArrowLeft, GitBranch, ImagePlus, MailPlus, Palette } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  addProjectMember,
  connectProjectRepository,
  createProject,
  createProjectFigmaLink,
  createWorkspaceInvitation,
  getGitConnections,
  getWorkspaceMembers,
  uploadProjectIcon,
} from "@/shared/lib/api-client";
import type { GitConnection, WorkspaceMember } from "@devflow/shared";

import styles from "./project-create-page.module.css";

export function ProjectCreatePage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [connections, setConnections] = useState<GitConnection[]>([]);
  const [iconPreview, setIconPreview] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void Promise.all([getWorkspaceMembers(workspaceId), getGitConnections()])
      .then(([membersResponse, gitResponse]) => {
        if (!active) return;
        setMembers(membersResponse.members.filter((member) => member.status === "active"));
        setConnections(gitResponse.connections);
      })
      .catch((caught) => active && setError(messageFor(caught, "Unable to prepare project creation.")))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [workspaceId]);

  function previewIcon(file?: File) {
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    setIconPreview(file ? URL.createObjectURL(file) : undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined); setIsSaving(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const key = String(form.get("key") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    try {
      const created = await createProject(workspaceId, { name, ...(key ? { key } : {}), ...(description ? { description } : {}) });
      const projectId = created.project.id;
      const selectedMembers = members.filter((member) => form.get(`member-${member.userId}`) === "on");
      const invitations = String(form.get("inviteEmails") ?? "").split(/[\n,;]/).map((email) => email.trim()).filter(Boolean);
      const icon = form.get("icon");
      const figmaUrl = String(form.get("figmaUrl") ?? "").trim();
      const figmaName = String(form.get("figmaName") ?? "").trim();
      const connectionId = String(form.get("connectionId") ?? "");
      const repository = String(form.get("repository") ?? "").trim();
      await Promise.all([
        icon instanceof File && icon.size ? uploadProjectIcon(workspaceId, projectId, icon) : Promise.resolve(),
        ...selectedMembers.map((member) => addProjectMember(workspaceId, projectId, { role: "member", userId: member.userId })),
        ...invitations.map((email) => createWorkspaceInvitation(workspaceId, { email, role: "member" })),
        figmaUrl ? createProjectFigmaLink(workspaceId, projectId, { name: figmaName || "Project design", url: figmaUrl }) : Promise.resolve(),
        connectionId && repository ? connectProjectRepository(workspaceId, projectId, { connectionId, fullName: repository }) : Promise.resolve(),
      ]);
      router.replace(`/workspaces/${workspaceId}/projects/${projectId}`);
    } catch (caught) {
      setError(messageFor(caught, "Project was created, but one of its connections could not be completed. Open its settings to finish setup."));
    } finally { setIsSaving(false); }
  }

  if (isLoading) return <main className={styles.loading}>Preparing project workspace…</main>;
  return <main className={styles.page}>
    <Link className={styles.back} href={`/workspaces/${workspaceId}`}><ArrowLeft size={17} /> Workspace dashboard</Link>
    <header className={styles.header}><div><h1>Create project</h1><p>Set up the delivery space once — people, design and repository are ready from the first task.</p></div></header>
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <section className={styles.section}><div className={styles.sectionHeading}><span className={styles.step}>1</span><div><h2>Project details</h2><p>Name the project and choose an icon visible across the workspace.</p></div></div><div className={styles.detailsGrid}>
        <label className={styles.iconUpload}><input accept="image/png,image/jpeg,image/webp" name="icon" onChange={(event) => previewIcon(event.target.files?.[0])} type="file" />{iconPreview ? <Image alt="Selected project icon" fill sizes="132px" src={iconPreview} unoptimized /> : <><ImagePlus size={25} /><span>Add image</span></>}</label>
        <div className={styles.fields}><label><span>Project name</span><input autoFocus maxLength={160} minLength={2} name="name" placeholder="Marketing website" required /></label><label><span>Project key</span><input maxLength={12} name="key" placeholder="WEB" /></label><label className={styles.wide}><span>Description</span><textarea maxLength={2000} name="description" placeholder="What outcome does this project deliver?" rows={4} /></label></div>
      </div></section>
      <section className={styles.section}><div className={styles.sectionHeading}><span className={styles.step}>2</span><div><h2>People</h2><p>Add existing workspace members or invite people who are not here yet.</p></div></div><div className={styles.memberGrid}>{members.length ? members.map((member) => <label className={styles.member} key={member.userId}><input name={`member-${member.userId}`} type="checkbox" /><span className={styles.avatar}>{member.user.displayName.slice(0, 2).toUpperCase()}</span><span><strong>{member.user.displayName}</strong><small>{member.user.email}</small></span></label>) : <p className={styles.muted}>No other active workspace members yet.</p>}</div><label className={styles.wide}><span><MailPlus size={15} /> Invite new members</span><textarea name="inviteEmails" placeholder="name@example.com, teammate@example.com" rows={2} /><small>Each address receives a workspace invitation. Add them to the project after they accept.</small></label></section>
      <section className={styles.section}><div className={styles.sectionHeading}><span className={styles.step}>3</span><div><h2>Tools and context</h2><p>Optional connections can also be changed later in project settings.</p></div></div><div className={styles.toolGrid}><div className={styles.tool}><Palette size={20} /><div><strong>Figma design</strong><p>Attach a shared design, prototype or file.</p></div><label><span>Name</span><input name="figmaName" placeholder="Product design" /></label><label><span>Figma URL</span><input name="figmaUrl" placeholder="https://figma.com/..." type="url" /></label></div><div className={styles.tool}><GitBranch size={20} /><div><strong>Source repository</strong><p>Choose an account connected in Profile → Setup.</p></div>{connections.length ? <><label><span>Git account</span><select defaultValue="" name="connectionId"><option value="">Connect later</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.provider === "github" ? "GitHub" : "GitLab"}: {connection.username}</option>)}</select></label><label><span>Repository</span><input name="repository" placeholder="owner/repository" /></label></> : <p className={styles.muted}>No Git account is connected. You can connect one in Profile → Setup.</p>}</div></div></section>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <footer className={styles.actions}><Link className={styles.cancel} href={`/workspaces/${workspaceId}`}>Cancel</Link><button disabled={isSaving} type="submit">{isSaving ? "Creating project…" : "Create project"}</button></footer>
    </form>
  </main>;
}
function messageFor(error: unknown, fallback: string) { return error instanceof ApiClientError ? error.message : fallback; }

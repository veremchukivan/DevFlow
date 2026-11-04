"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Trash2, Users } from "lucide-react";

import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  updateProjectMember,
} from "@/shared/lib/api-client";
import { Modal } from "@/shared/components/modal";
import type {
  ProjectMember,
  ProjectMemberRole,
  WorkspaceMember,
} from "@devflow/shared";
import styles from "@/shared/styles/ui.module.css";

const roles: ProjectMemberRole[] = ["lead", "member", "viewer"];

export function ProjectTeamModal({
  canManage,
  members: workspaceMembers,
  onClose,
  projectId,
  workspaceId,
}: {
  canManage: boolean;
  members: WorkspaceMember[];
  onClose: () => void;
  projectId: string;
  workspaceId: string;
}) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getProjectMembers(workspaceId, projectId)
      .then(({ members }) => setMembers(members))
      .catch(() => setError("Unable to load the project team."))
      .finally(() => setIsLoading(false));
  }, [projectId, workspaceId]);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    setError(undefined);
    try {
      const response = await addProjectMember(workspaceId, projectId, {
        role: form.get("role") as ProjectMemberRole,
        userId: String(form.get("userId")),
      });
      setMembers((current) => [
        ...current.filter((member) => member.userId !== response.member.userId),
        response.member,
      ]);
      event.currentTarget.reset();
    } catch {
      setError("Unable to add this member to the project.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onRoleChange(userId: string, role: ProjectMemberRole) {
    setIsSaving(true);
    try {
      const response = await updateProjectMember(
        workspaceId,
        projectId,
        userId,
        { role },
      );
      setMembers((current) =>
        current.map((member) =>
          member.userId === userId ? response.member : member,
        ),
      );
    } catch {
      setError("Unable to update the project role.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onRemove(userId: string) {
    setIsSaving(true);
    try {
      await removeProjectMember(workspaceId, projectId, userId);
      setMembers((current) =>
        current.filter((member) => member.userId !== userId),
      );
    } catch {
      setError("Unable to remove this project member.");
    } finally {
      setIsSaving(false);
    }
  }

  const available = workspaceMembers.filter(
    (member) => !members.some((item) => item.userId === member.userId),
  );

  return (
    <Modal isOpen onClose={onClose} title="Project team" width="wide">
      <section className={styles.workspaceSection}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Members and workload</h2>
            <p>Open and completed work is calculated from assigned tasks.</p>
          </div>
          <Users aria-hidden="true" size={20} />
        </div>
        {canManage && available.length ? (
          <form
            className={styles.memberInviteForm}
            onSubmit={(event) => void onAdd(event)}
          >
            <label>
              <span>Workspace member</span>
              <select name="userId" required>
                <option value="">Choose a person</option>
                {available.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Project role</span>
              <select defaultValue="member" name="role">
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={styles.primaryButton}
              disabled={isSaving}
              type="submit"
            >
              Add to project
            </button>
          </form>
        ) : null}
        {error ? <p className={styles.formError}>{error}</p> : null}
        {isLoading ? (
          <p>Loading team…</p>
        ) : (
          <ul className={styles.projectTeamList}>
            {members.map((member) => (
              <li key={member.userId}>
                <div>
                  <strong>{member.user.displayName}</strong>
                  <span>
                    {member.user.email} · {member.openTaskCount} open ·{" "}
                    {member.completedTaskCount} completed
                  </span>
                </div>
                {canManage ? (
                  <div>
                    <select
                      disabled={isSaving}
                      onChange={(event) =>
                        void onRoleChange(
                          member.userId,
                          event.target.value as ProjectMemberRole,
                        )
                      }
                      value={member.role}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label={`Remove ${member.user.displayName}`}
                      className={styles.textButton}
                      disabled={isSaving}
                      onClick={() => void onRemove(member.userId)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <span className={styles.roleBadge}>{member.role}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}

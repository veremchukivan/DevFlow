"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  createWorkspaceInvitation,
  getWorkspace,
  getWorkspaceInvitations,
  getWorkspaceMembers,
  updateWorkspaceMember,
} from "@/lib/api-client";
import {
  can,
  type Workspace,
  type WorkspaceInvitation,
  type WorkspaceMember,
  type WorkspaceMemberAssignableRole,
} from "@devflow/shared";

import styles from "@/components/ui.module.css";

const assignableRoles: WorkspaceMemberAssignableRole[] = [
  "admin",
  "member",
  "viewer",
];

export function WorkspaceMembers() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string>();

  const canManage = workspace ? can(workspace.role, "member:manage") : false;

  useEffect(() => {
    let active = true;
    void getWorkspace(params.workspaceId)
      .then(async (workspaceResponse) => {
        const canManageMembers = can(
          workspaceResponse.workspace.role,
          "member:manage",
        );
        const [membersResponse, invitationsResponse] = await Promise.all([
          getWorkspaceMembers(params.workspaceId),
          canManageMembers
            ? getWorkspaceInvitations(params.workspaceId)
            : Promise.resolve(undefined),
        ]);

        if (!active) return;
        setWorkspace(workspaceResponse.workspace);
        setMembers(membersResponse.members);
        setInvitations(invitationsResponse?.invitations ?? []);
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }
        if (active) setError("Unable to load workspace members.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.workspaceId, router]);

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsInviting(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await createWorkspaceInvitation(params.workspaceId, {
        email: String(data.get("email") ?? ""),
        role: data.get("role") as WorkspaceMemberAssignableRole,
      });
      setInvitations((current) => [response.invitation, ...current]);
      form.reset();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to send the invitation.",
      );
    } finally {
      setIsInviting(false);
    }
  }

  async function onRoleChange(
    member: WorkspaceMember,
    role: WorkspaceMemberAssignableRole,
  ) {
    setError(undefined);
    setUpdatingMemberId(member.userId);
    try {
      const response = await updateWorkspaceMember(
        params.workspaceId,
        member.userId,
        { role },
      );
      setMembers((current) =>
        current.map((item) =>
          item.userId === member.userId ? response.member : item,
        ),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update the member role.",
      );
    } finally {
      setUpdatingMemberId(undefined);
    }
  }

  if (isLoading) return <main className={styles.loading}>Loading team</main>;

  return (
    <main className={styles.workspaceHome}>
      <Link
        className={styles.backLink}
        href={`/workspaces/${params.workspaceId}`}
      >
        Back to workspace
      </Link>
      <header className={styles.workspaceHomeHeader}>
        <div>
          <p className={styles.eyebrow}>{workspace?.name ?? "Workspace"}</p>
          <h1>Team</h1>
          <p>Manage the people who can access this workspace.</p>
        </div>
      </header>
      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <section
          className={styles.workspaceSection}
          aria-labelledby="invite-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="invite-title">Invite member</h2>
          </div>
          <form className={styles.memberInviteForm} onSubmit={onInvite}>
            <label>
              <span>Email</span>
              <input name="email" required type="email" />
            </label>
            <label>
              <span>Role</span>
              <select defaultValue="member" name="role">
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={styles.primaryButton}
              disabled={isInviting}
              type="submit"
            >
              {isInviting ? "Sending" : "Send invite"}
            </button>
          </form>
        </section>
      ) : null}

      <section
        className={styles.workspaceSection}
        aria-labelledby="members-title"
      >
        <div className={styles.sectionHeading}>
          <h2 id="members-title">Members</h2>
          <p>{members.length} active</p>
        </div>
        <div className={styles.memberList}>
          {members.map((member) => (
            <div className={styles.memberRow} key={member.userId}>
              <div>
                <strong>{member.user.displayName}</strong>
                <span>{member.user.email}</span>
              </div>
              {canManage && member.role !== "owner" ? (
                <select
                  disabled={updatingMemberId === member.userId}
                  onChange={(event) =>
                    void onRoleChange(
                      member,
                      event.target.value as WorkspaceMemberAssignableRole,
                    )
                  }
                  value={member.role}
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={styles.roleBadge}>{member.role}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {canManage && invitations.length ? (
        <section
          className={styles.workspaceSection}
          aria-labelledby="invitations-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="invitations-title">Pending invitations</h2>
          </div>
          <div className={styles.memberList}>
            {invitations
              .filter(
                (invitation) =>
                  !invitation.acceptedAt && !invitation.rejectedAt,
              )
              .map((invitation) => (
                <div className={styles.memberRow} key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <span>Expires {formatDate(invitation.expiresAt)}</span>
                  </div>
                  <span className={styles.roleBadge}>{invitation.role}</span>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  cancelWorkspaceInvitation,
  createWorkspaceInvitation,
  getCurrentUser,
  getWorkspace,
  getWorkspaceInvitations,
  getWorkspaceMembers,
  leaveWorkspace,
  removeWorkspaceMember,
  resendWorkspaceInvitation,
  updateWorkspaceMember,
  transferWorkspaceOwnership,
} from "@/shared/lib/api-client";
import { notifyWorkspacesChanged } from "@/shared/lib/workspace-events";
import {
  can,
  type Workspace,
  type WorkspaceInvitation,
  type WorkspaceMember,
  type WorkspaceMemberAssignableRole,
  type AuthUser,
} from "@devflow/shared";

import styles from "@/shared/styles/ui.module.css";

const assignableRoles: WorkspaceMemberAssignableRole[] = [
  "admin",
  "member",
  "viewer",
];
const manageableStatuses = ["active", "suspended"] as const;

export function WorkspaceMembers() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string>();
  const [removingMemberId, setRemovingMemberId] = useState<string>();
  const [isLeaving, setIsLeaving] = useState(false);
  const [transferringOwnershipId, setTransferringOwnershipId] = useState<string>();
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string>();
  const [resendingInvitationId, setResendingInvitationId] = useState<string>();

  const canManage = workspace ? can(workspace.role, "member:manage") : false;

  useEffect(() => {
    let active = true;
    void getWorkspace(params.workspaceId)
      .then(async (workspaceResponse) => {
        const canManageMembers = can(
          workspaceResponse.workspace.role,
          "member:manage",
        );
        const [currentUserResponse, membersResponse, invitationsResponse] =
          await Promise.all([
            getCurrentUser(),
            getWorkspaceMembers(params.workspaceId),
            canManageMembers
              ? getWorkspaceInvitations(params.workspaceId)
              : Promise.resolve(undefined),
          ]);

        if (!active) return;
        setWorkspace(workspaceResponse.workspace);
        setCurrentUser(currentUserResponse.user);
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

  async function onStatusChange(
    member: WorkspaceMember,
    status: (typeof manageableStatuses)[number],
  ) {
    setError(undefined);
    setUpdatingMemberId(member.userId);
    try {
      const response = await updateWorkspaceMember(
        params.workspaceId,
        member.userId,
        { status },
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
          : "Unable to update the member status.",
      );
    } finally {
      setUpdatingMemberId(undefined);
    }
  }

  async function onRemoveMember(member: WorkspaceMember) {
    if (!window.confirm(`Remove ${member.user.displayName} from this workspace?`)) {
      return;
    }

    setError(undefined);
    setRemovingMemberId(member.userId);
    try {
      await removeWorkspaceMember(params.workspaceId, member.userId);
      setMembers((current) =>
        current.filter((item) => item.userId !== member.userId),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to remove the member.",
      );
    } finally {
      setRemovingMemberId(undefined);
    }
  }

  async function onLeaveWorkspace() {
    if (!window.confirm("Leave this workspace? You will lose access to its projects.")) {
      return;
    }

    setError(undefined);
    setIsLeaving(true);
    try {
      await leaveWorkspace(params.workspaceId);
      notifyWorkspacesChanged();
      router.replace("/workspaces");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to leave this workspace.",
      );
    } finally {
      setIsLeaving(false);
    }
  }

  async function onTransferOwnership(member: WorkspaceMember) {
    if (!window.confirm(`Transfer workspace ownership to ${member.user.displayName}? You will become an admin.`)) return;
    setError(undefined);
    setTransferringOwnershipId(member.userId);
    try {
      await transferWorkspaceOwnership(params.workspaceId, member.userId);
      const [workspaceResponse, membersResponse] = await Promise.all([getWorkspace(params.workspaceId), getWorkspaceMembers(params.workspaceId)]);
      setWorkspace(workspaceResponse.workspace);
      setMembers(membersResponse.members);
      notifyWorkspacesChanged();
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "Unable to transfer workspace ownership.");
    } finally {
      setTransferringOwnershipId(undefined);
    }
  }

  async function onCancelInvitation(invitation: WorkspaceInvitation) {
    if (!window.confirm(`Cancel the invitation for ${invitation.email}?`)) {
      return;
    }

    setError(undefined);
    setCancellingInvitationId(invitation.id);
    try {
      await cancelWorkspaceInvitation(params.workspaceId, invitation.id);
      setInvitations((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to cancel the invitation.",
      );
    } finally {
      setCancellingInvitationId(undefined);
    }
  }

  async function onResendInvitation(invitation: WorkspaceInvitation) {
    setError(undefined);
    setResendingInvitationId(invitation.id);
    try {
      const response = await resendWorkspaceInvitation(
        params.workspaceId,
        invitation.id,
      );
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitation.id ? response.invitation : item,
        ),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to resend the invitation.",
      );
    } finally {
      setResendingInvitationId(undefined);
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
        {workspace && workspace.role !== "owner" ? (
          <button
            className={styles.textButton}
            disabled={isLeaving}
            onClick={() => void onLeaveWorkspace()}
            type="button"
          >
            {isLeaving ? "Leaving" : "Leave workspace"}
          </button>
        ) : null}
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
                {rolesForInvitation(workspace?.role).map((role) => (
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
          <p>
            {members.filter((member) => member.status === "active").length} active
          </p>
        </div>
        <div className={styles.memberList}>
          {members.map((member) => (
            <div className={styles.memberRow} key={member.userId}>
              <div>
                <strong>{member.user.displayName}</strong>
                <span>{member.user.email}</span>
              </div>
              {canManageMember(workspace, currentUser, member) ? (
                <div className={styles.memberActions}>
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
                    {rolesForMember(
                      workspace?.role ?? "viewer",
                      member.role,
                    ).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <select
                    disabled={updatingMemberId === member.userId}
                    onChange={(event) =>
                      void onStatusChange(
                        member,
                        event.target.value as (typeof manageableStatuses)[number],
                      )
                    }
                    value={member.status}
                  >
                    {manageableStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.textButton}
                    disabled={removingMemberId === member.userId}
                    onClick={() => void onRemoveMember(member)}
                    type="button"
                  >
                    {removingMemberId === member.userId ? "Removing" : "Remove"}
                  </button>
                  {workspace?.role === "owner" && member.status === "active" ? (
                    <button className={styles.textButton} disabled={transferringOwnershipId === member.userId} onClick={() => void onTransferOwnership(member)} type="button">
                      {transferringOwnershipId === member.userId ? "Transferring" : "Make owner"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className={styles.memberBadges}>
                  <span className={styles.roleBadge}>{member.role}</span>
                  {member.status !== "active" ? (
                    <span className={styles.roleBadge}>{member.status}</span>
                  ) : null}
                </div>
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
                  <div className={styles.memberActions}>
                    <span className={styles.roleBadge}>{invitation.role}</span>
                    <button
                      className={styles.textButton}
                      disabled={resendingInvitationId === invitation.id}
                      onClick={() => void onResendInvitation(invitation)}
                      type="button"
                    >
                      {resendingInvitationId === invitation.id
                        ? "Sending"
                        : "Resend"}
                    </button>
                    <button
                      className={styles.textButton}
                      disabled={cancellingInvitationId === invitation.id}
                      onClick={() => void onCancelInvitation(invitation)}
                      type="button"
                    >
                      {cancellingInvitationId === invitation.id
                        ? "Cancelling"
                        : "Cancel"}
                    </button>
                  </div>
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

function canManageMember(
  workspace: Workspace | undefined,
  currentUser: AuthUser | undefined,
  member: WorkspaceMember,
) {
  if (!workspace || !currentUser || member.userId === currentUser.id) {
    return false;
  }

  return (
    can(workspace.role, "member:manage") &&
    member.role !== "owner" &&
    !(workspace.role === "admin" && member.role === "admin")
  );
}

function rolesForMember(
  actorRole: Workspace["role"],
  memberRole: WorkspaceMember["role"],
) {
  if (actorRole === "admin" && memberRole !== "admin") {
    return assignableRoles.filter((role) => role !== "admin");
  }

  return assignableRoles;
}

function rolesForInvitation(role: Workspace["role"] | undefined) {
  return role === "admin"
    ? assignableRoles.filter((assignableRole) => assignableRole !== "admin")
    : assignableRoles;
}

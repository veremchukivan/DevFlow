"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  acceptWorkspaceInvitation,
  ApiClientError,
  declineWorkspaceInvitation,
  getCurrentUser,
  getPublicWorkspaceInvitation,
} from "@/shared/lib/api-client";
import type { AuthUser, PublicWorkspaceInvitation } from "@devflow/shared";
import styles from "@/shared/styles/ui.module.css";

export function InvitationPage({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<PublicWorkspaceInvitation>();
  const [user, setUser] = useState<AuthUser>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let active = true;

    void Promise.all([
      getPublicWorkspaceInvitation(token),
      getCurrentUser().catch(() => undefined),
    ])
      .then(([invitationResponse, userResponse]) => {
        if (!active) return;
        setInvitation(invitationResponse.invitation);
        setUser(userResponse?.user);
      })
      .catch((caughtError: unknown) => {
        if (!active) return;
        setError(
          caughtError instanceof ApiClientError
            ? caughtError.message
            : "Unable to load this invitation.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function onAccept() {
    setError(undefined);
    setIsSubmitting(true);
    try {
      const response = await acceptWorkspaceInvitation(token);
      router.replace(`/workspaces/${response.workspaceId}`);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to accept this invitation.",
      );
      setIsSubmitting(false);
    }
  }

  async function onDecline() {
    setError(undefined);
    setIsSubmitting(true);
    try {
      await declineWorkspaceInvitation(token);
      setIsComplete(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to decline this invitation.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const next = `/invitations/${encodeURIComponent(token)}`;
  const unavailable =
    invitation?.isAccepted || invitation?.isRejected || invitation?.isExpired;

  return (
    <main className={styles.authPage}>
      <section className={styles.authPanel} aria-labelledby="invitation-title">
        <div className={styles.authBrand}>DevFlow</div>
        {isLoading ? <p className={styles.authSubtitle}>Loading invitation</p> : null}
        {!isLoading && error && !invitation ? (
          <>
            <h1 id="invitation-title">Invitation unavailable</h1>
            <p className={styles.formError} role="alert">
              {error}
            </p>
            <p className={styles.authSwitch}>
              <Link href="/">Back to DevFlow</Link>
            </p>
          </>
        ) : null}
        {!isLoading && invitation ? (
          <>
            <h1 id="invitation-title">
              {isComplete
                ? "Invitation declined"
                : unavailable
                  ? "Invitation unavailable"
                  : `Join ${invitation.workspaceName}`}
            </h1>
            <p className={styles.authSubtitle}>
              {isComplete
                ? "You will not be added to this workspace."
                : unavailable
                  ? invitation.isAccepted
                    ? "This invitation has already been accepted."
                    : invitation.isRejected
                      ? "This invitation has already been declined."
                      : "This invitation has expired."
                  : `${invitation.inviterDisplayName ?? "A workspace member"} invited ${invitation.email} as ${invitation.role}.`}
            </p>
            {!unavailable && !isComplete ? (
              <div className={styles.formActions}>
                {user ? (
                  <button
                    className={styles.primaryButton}
                    disabled={isSubmitting}
                    onClick={() => void onAccept()}
                    type="button"
                  >
                    {isSubmitting ? "Please wait" : "Accept invitation"}
                  </button>
                ) : (
                  <>
                    <Link
                      className={styles.primaryButton}
                      href={`/login?next=${encodeURIComponent(next)}`}
                    >
                      Sign in to accept
                    </Link>
                    <Link
                      className={styles.secondaryButton}
                      href={`/register?next=${encodeURIComponent(next)}`}
                    >
                      Create account
                    </Link>
                  </>
                )}
                <button
                  className={styles.textButton}
                  disabled={isSubmitting}
                  onClick={() => void onDecline()}
                  type="button"
                >
                  Decline
                </button>
              </div>
            ) : null}
            {error ? (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

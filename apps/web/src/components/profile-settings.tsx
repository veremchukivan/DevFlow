"use client";

import { CheckCircle2, KeyRound, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  changePassword,
  getCurrentUser,
  logout,
  updateProfile,
} from "@/lib/api-client";
import { notifyUserChanged } from "@/lib/user-events";
import type { AuthUser } from "@devflow/shared";

import styles from "./profile-settings.module.css";

export function ProfileSettings() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    void getCurrentUser()
      .then((response) => {
        if (active) setUser(response.user);
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(toMessage(caughtError, "Unable to load your profile."));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function onProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);
    setIsSavingProfile(true);

    const displayName = String(
      new FormData(event.currentTarget).get("displayName") ?? "",
    );

    try {
      const response = await updateProfile({ displayName });
      setUser(response.user);
      notifyUserChanged(response.user);
      setMessage("Profile saved.");
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to save your profile."));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (newPassword !== confirmation) {
      setError("New password and confirmation must match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword({
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword,
      });
      router.replace("/login?reason=password-changed");
      router.refresh();
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to change your password."));
      setIsChangingPassword(false);
    }
  }

  async function onSignOut() {
    setIsSigningOut(true);
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
      setIsSigningOut(false);
    }
  }

  if (isLoading) return <main className={styles.loading}>Loading profile</main>;

  if (!user) {
    return (
      <main className={styles.loading}>
        {error ?? "Profile is unavailable."}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Account</p>
          <h1>Profile settings</h1>
          <p>Manage the details associated with your DevFlow account.</p>
        </div>
        <span aria-label={user.displayName} className={styles.avatar}>
          {initials(user.displayName)}
        </span>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className={styles.success} role="status">
          <CheckCircle2 aria-hidden="true" size={17} />
          {message}
        </p>
      ) : null}

      <section className={styles.section} aria-labelledby="personal-title">
        <div className={styles.sectionIntro}>
          <UserRound aria-hidden="true" size={19} />
          <div>
            <h2 id="personal-title">Personal details</h2>
            <p>This is how teammates see you in a workspace.</p>
          </div>
        </div>
        <form className={styles.form} onSubmit={onProfileSubmit}>
          <label>
            <span>Display name</span>
            <input
              defaultValue={user.displayName}
              maxLength={120}
              minLength={1}
              name="displayName"
              required
            />
          </label>
          <label>
            <span>Email address</span>
            <input disabled value={user.email} readOnly />
            <small>Email changes are not available yet.</small>
          </label>
          <div className={styles.formFooter}>
            <p
              className={
                user.isEmailVerified ? styles.verified : styles.unverified
              }
            >
              {user.isEmailVerified ? "Email verified" : "Email not verified"}
            </p>
            <button
              className={styles.primaryButton}
              disabled={isSavingProfile}
              type="submit"
            >
              {isSavingProfile ? "Saving" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section} aria-labelledby="security-title">
        <div className={styles.sectionIntro}>
          <KeyRound aria-hidden="true" size={19} />
          <div>
            <h2 id="security-title">Password</h2>
            <p>Choose a new password to protect your account.</p>
          </div>
        </div>
        <form className={styles.form} onSubmit={onPasswordSubmit}>
          <label>
            <span>Current password</span>
            <input
              autoComplete="current-password"
              maxLength={256}
              name="currentPassword"
              required
              type="password"
            />
          </label>
          <label>
            <span>New password</span>
            <input
              autoComplete="new-password"
              maxLength={256}
              minLength={8}
              name="newPassword"
              required
              type="password"
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              maxLength={256}
              minLength={8}
              name="confirmation"
              required
              type="password"
            />
          </label>
          <div className={styles.formFooter}>
            <p>Changing your password signs you out on every device.</p>
            <button
              className={styles.secondaryButton}
              disabled={isChangingPassword}
              type="submit"
            >
              {isChangingPassword ? "Updating" : "Update password"}
            </button>
          </div>
        </form>
      </section>

      <section
        className={`${styles.section} ${styles.signOutSection}`}
        aria-labelledby="sign-out-title"
      >
        <div className={styles.sectionIntro}>
          <LogOut aria-hidden="true" size={19} />
          <div>
            <h2 id="sign-out-title">Sign out</h2>
            <p>End this session on the current device.</p>
          </div>
        </div>
        <button
          className={styles.signOutButton}
          disabled={isSigningOut}
          onClick={onSignOut}
          type="button"
        >
          {isSigningOut ? "Signing out" : "Sign out"}
        </button>
      </section>
    </main>
  );
}

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

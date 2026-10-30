"use client";

import {
  Bot,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Database,
  Download,
  Palette,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  TerminalSquare,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  changePassword,
  deleteAccount,
  deleteAiSettings,
  deleteProfileAvatar,
  getApiAssetUrl,
  getAccountDataExportUrl,
  getAccountSessions,
  getCurrentUser,
  logout,
  resendEmailVerification,
  requestEmailChange,
  createApiToken,
  disconnectFigma,
  getApiTokens,
  getAiSettings,
  getFigmaConnection,
  revokeApiToken,
  revokeAccountSession,
  revokeOtherAccountSessions,
  updateProfile,
  updateAiSettings,
  uploadProfileAvatar,
} from "@/shared/lib/api-client";
import { notifyUserChanged } from "@/shared/lib/user-events";
import type { AccountSession, AuthUser } from "@devflow/shared";

import styles from "./profile-settings.module.css";

type SettingsSection =
  "profile" | "security" | "billing" | "setup" | "ai" | "data";

const navigation: Array<{
  icon: LucideIcon;
  id: SettingsSection;
  label: string;
}> = [
  { icon: UserRound, id: "profile", label: "Profile" },
  { icon: ShieldCheck, id: "security", label: "Security" },
  { icon: CreditCard, id: "billing", label: "Billing" },
  { icon: TerminalSquare, id: "setup", label: "Setup" },
  { icon: Bot, id: "ai", label: "AI" },
  { icon: Database, id: "data", label: "Data" },
];

export function ProfileSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser>();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("profile");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isRevokingOtherSessions, setIsRevokingOtherSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string>();
  const [sessions, setSessions] = useState<AccountSession[]>([]);

  useEffect(() => {
    const section = searchParams.get("section");
    if (navigation.some((item) => item.id === section)) {
      setActiveSection(section as SettingsSection);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((response) => active && setUser(response.user))
      .catch(
        (caughtError: unknown) =>
          active &&
          setError(toMessage(caughtError, "Unable to load your profile.")),
      )
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "security") return;

    let active = true;
    setIsLoadingSessions(true);
    void getAccountSessions()
      .then((response) => active && setSessions(response.sessions))
      .catch(
        (caughtError: unknown) =>
          active &&
          setError(toMessage(caughtError, "Unable to load active sessions.")),
      )
      .finally(() => active && setIsLoadingSessions(false));

    return () => {
      active = false;
    };
  }, [activeSection]);

  function clearNotices() {
    setError(undefined);
    setMessage(undefined);
  }

  async function onProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotices();
    setIsSavingProfile(true);
    try {
      const response = await updateProfile({
        displayName: String(
          new FormData(event.currentTarget).get("displayName") ?? "",
        ),
      });
      setUser(response.user);
      notifyUserChanged(response.user);
      setMessage("Profile saved.");
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to save your profile."));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onAvatarChange(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    clearNotices();
    setIsSavingAvatar(true);
    try {
      const response = await uploadProfileAvatar(file);
      setUser(response.user);
      notifyUserChanged(response.user);
      setMessage("Profile photo updated.");
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to upload the profile photo."));
    } finally {
      event.currentTarget.value = "";
      setIsSavingAvatar(false);
    }
  }

  async function onAvatarRemove() {
    clearNotices();
    setIsSavingAvatar(true);
    try {
      const response = await deleteProfileAvatar();
      setUser(response.user);
      notifyUserChanged(response.user);
      setMessage("Profile photo removed.");
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to remove the profile photo."));
    } finally {
      setIsSavingAvatar(false);
    }
  }

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotices();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmation") ?? "")) {
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

  async function onDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotices();
    const form = new FormData(event.currentTarget);
    if (String(form.get("confirmation") ?? "") !== "DELETE") {
      setError('Type "DELETE" to confirm account deletion.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount({
        currentPassword: String(form.get("currentPassword") ?? ""),
      });
      router.replace("/login?reason=account-deleted");
      router.refresh();
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to delete your account."));
      setIsDeletingAccount(false);
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

  async function onResendVerification() {
    clearNotices();
    setIsResendingVerification(true);
    try {
      await resendEmailVerification();
      setMessage("Verification email sent.");
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to send verification email."));
    } finally {
      setIsResendingVerification(false);
    }
  }

  async function onEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotices();
    const form = new FormData(event.currentTarget);
    setIsRequestingEmailChange(true);
    try {
      await requestEmailChange({
        currentPassword: String(form.get("currentPassword") ?? ""),
        email: String(form.get("email") ?? ""),
      });
      event.currentTarget.reset();
      setMessage("Confirmation link sent to your new email address.");
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to request an email change."));
    } finally {
      setIsRequestingEmailChange(false);
    }
  }

  async function onRevokeSession(session: AccountSession) {
    clearNotices();
    setRevokingSessionId(session.id);
    try {
      await revokeAccountSession(session.id);
      if (session.current) {
        router.replace("/login?reason=session-ended");
        router.refresh();
        return;
      }
      setSessions((current) => current.filter(({ id }) => id !== session.id));
      setMessage("Session signed out.");
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to end this session."));
    } finally {
      setRevokingSessionId(undefined);
    }
  }

  async function onRevokeOtherSessions() {
    clearNotices();
    setIsRevokingOtherSessions(true);
    try {
      await revokeOtherAccountSessions();
      setSessions((current) => current.filter((session) => session.current));
      setMessage("Other sessions have been signed out.");
    } catch (caughtError) {
      setError(toMessage(caughtError, "Unable to end other sessions."));
    } finally {
      setIsRevokingOtherSessions(false);
    }
  }

  if (isLoading) return <main className={styles.loading}>Loading profile</main>;
  if (!user)
    return (
      <main className={styles.loading}>
        {error ?? "Profile is unavailable."}
      </main>
    );

  const section = navigation.find((item) => item.id === activeSection)!;
  const SectionIcon = section.icon;

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.accountSummary}>
          <Avatar user={user} />
          <div>
            <strong>{user.displayName}</strong>
            <span>{user.email}</span>
          </div>
        </div>
        <nav aria-label="Account settings" className={styles.navigation}>
          <p>Settings</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-current={activeSection === item.id ? "page" : undefined}
                className={
                  activeSection === item.id
                    ? styles.activeNavItem
                    : styles.navItem
                }
                key={item.id}
                onClick={() => {
                  clearNotices();
                  setActiveSection(item.id);
                }}
                type="button"
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button
          className={styles.signOutButton}
          disabled={isSigningOut}
          onClick={() => void onSignOut()}
          type="button"
        >
          <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
          {isSigningOut ? "Signing out" : "Sign out"}
        </button>
      </aside>
      <section className={styles.content}>
        <header className={styles.heading}>
          <SectionIcon aria-hidden="true" size={22} strokeWidth={1.8} />
          <div>
            <h1>{section.label}</h1>
            <p>{sectionDescription(activeSection)}</p>
          </div>
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
        {activeSection === "profile" ? (
          <ProfilePanel
            isResendingVerification={isResendingVerification}
            isSavingAvatar={isSavingAvatar}
            isSavingProfile={isSavingProfile}
            onAvatarChange={onAvatarChange}
            onAvatarRemove={onAvatarRemove}
            onProfileSubmit={onProfileSubmit}
            isRequestingEmailChange={isRequestingEmailChange}
            onEmailChange={onEmailChange}
            onResendVerification={onResendVerification}
            user={user}
          />
        ) : null}
        {activeSection === "security" ? (
          <SecurityPanel
            isChangingPassword={isChangingPassword}
            isLoadingSessions={isLoadingSessions}
            isRevokingOtherSessions={isRevokingOtherSessions}
            onRevokeOtherSessions={onRevokeOtherSessions}
            onRevokeSession={onRevokeSession}
            onPasswordSubmit={onPasswordSubmit}
            revokingSessionId={revokingSessionId}
            sessions={sessions}
          />
        ) : null}
        {activeSection === "billing" ? <BillingPanel /> : null}
        {activeSection === "setup" ? <SetupPanel /> : null}
        {activeSection === "ai" ? <AiPanel /> : null}
        {activeSection === "data" ? (
          <DataPanel
            isDeletingAccount={isDeletingAccount}
            onDeleteAccount={onDeleteAccount}
          />
        ) : null}
      </section>
    </main>
  );
}

function ProfilePanel(props: {
  isResendingVerification: boolean;
  isSavingAvatar: boolean;
  isSavingProfile: boolean;
  onAvatarChange: (event: FormEvent<HTMLInputElement>) => Promise<void>;
  onAvatarRemove: () => Promise<void>;
  isRequestingEmailChange: boolean;
  onEmailChange: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onProfileSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onResendVerification: () => Promise<void>;
  user: AuthUser;
}) {
  const { user } = props;
  return (
    <>
      <section className={styles.card}>
        <CardHeading
          icon={UserRound}
          subtitle="Your display name and avatar"
          title="Profile"
        />
        <form
          className={styles.form}
          onSubmit={(event) => void props.onProfileSubmit(event)}
        >
          <div className={styles.photoField}>
            <Avatar large user={user} />
            <div>
              <label className={styles.secondaryButton}>
                {props.isSavingAvatar ? "Uploading" : "Change photo"}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={props.isSavingAvatar}
                  onChange={(event) => void props.onAvatarChange(event)}
                  type="file"
                />
              </label>
              {user.avatarUrl ? (
                <button
                  className={styles.textButton}
                  disabled={props.isSavingAvatar}
                  onClick={() => void props.onAvatarRemove()}
                  type="button"
                >
                  Remove photo
                </button>
              ) : null}
              <p>PNG, JPEG or WebP. Maximum 2 MB.</p>
            </div>
          </div>
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
          <div className={styles.formFooter}>
            <span />
            <button
              className={styles.primaryButton}
              disabled={props.isSavingProfile}
              type="submit"
            >
              {props.isSavingProfile ? "Saving" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
      <section className={styles.card}>
        <CardHeading
          icon={Mail}
          subtitle="Your email address for notifications and login"
          title="Email"
        />
        <div className={styles.infoRow}>
          <span>{user.email}</span>
          <strong
            className={
              user.isEmailVerified ? styles.verified : styles.unverified
            }
          >
            {user.isEmailVerified ? "Verified" : "Not verified"}
          </strong>
        </div>
        {!user.isEmailVerified ? (
          <button
            className={styles.secondaryButton}
            disabled={props.isResendingVerification}
            onClick={() => void props.onResendVerification()}
            type="button"
          >
            {props.isResendingVerification ? "Sending" : "Resend verification"}
          </button>
        ) : null}
        <form
          className={styles.form}
          onSubmit={(event) => void props.onEmailChange(event)}
        >
          <label>
            <span>New email address</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
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
          <div className={styles.formFooter}>
            <span />
            <button
              className={styles.secondaryButton}
              disabled={props.isRequestingEmailChange}
              type="submit"
            >
              {props.isRequestingEmailChange
                ? "Sending confirmation"
                : "Change email"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function SecurityPanel(props: {
  isChangingPassword: boolean;
  isLoadingSessions: boolean;
  isRevokingOtherSessions: boolean;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRevokeOtherSessions: () => Promise<void>;
  onRevokeSession: (session: AccountSession) => Promise<void>;
  revokingSessionId?: string;
  sessions: AccountSession[];
}) {
  return (
    <>
      <section className={styles.card}>
        <CardHeading
          icon={KeyRound}
          subtitle="Changing your password signs you out on every device"
          title="Password"
        />
        <form
          className={styles.form}
          onSubmit={(event) => void props.onPasswordSubmit(event)}
        >
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
            <span />
            <button
              className={styles.primaryButton}
              disabled={props.isChangingPassword}
              type="submit"
            >
              {props.isChangingPassword ? "Updating" : "Update password"}
            </button>
          </div>
        </form>
      </section>
      <section className={styles.card}>
        <CardHeading
          icon={ShieldCheck}
          subtitle="Review devices that are currently signed in to your account"
          title="Active sessions"
        />
        <div className={styles.sessionToolbar}>
          <p>End access on a lost or unrecognised device straight away.</p>
          <button
            className={styles.secondaryButton}
            disabled={
              props.isRevokingOtherSessions ||
              !props.sessions.some((session) => !session.current)
            }
            onClick={() => void props.onRevokeOtherSessions()}
            type="button"
          >
            {props.isRevokingOtherSessions
              ? "Signing out"
              : "Sign out other devices"}
          </button>
        </div>
        {props.isLoadingSessions ? (
          <p className={styles.mutedCopy}>Loading active sessions…</p>
        ) : props.sessions.length === 0 ? (
          <p className={styles.mutedCopy}>No active sessions were found.</p>
        ) : (
          <ul className={styles.sessionList}>
            {props.sessions.map((session) => (
              <li key={session.id}>
                <div>
                  <strong>{getSessionDeviceName(session.userAgent)}</strong>
                  <span>
                    {session.current
                      ? "This device"
                      : `Last active ${formatDateTime(session.lastSeenAt)}`}
                    {session.ipAddress ? ` · ${session.ipAddress}` : ""}
                  </span>
                </div>
                <button
                  className={styles.textButton}
                  disabled={props.revokingSessionId === session.id}
                  onClick={() => void props.onRevokeSession(session)}
                  type="button"
                >
                  {props.revokingSessionId === session.id
                    ? "Signing out"
                    : session.current
                      ? "Sign out"
                      : "End session"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function getSessionDeviceName(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  if (/iPhone|iPad/i.test(userAgent)) return "Apple mobile device";
  if (/Android/i.test(userAgent)) return "Android device";
  if (/Windows/i.test(userAgent)) return "Windows device";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "Mac";
  if (/Linux/i.test(userAgent)) return "Linux device";
  return "Browser session";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function BillingPanel() {
  return (
    <>
      <section className={styles.card}>
        <CardHeading
          icon={CircleDollarSign}
          subtitle="Your current subscription"
          title="Current plan"
        />
        <div className={styles.planRow}>
          <strong>Free</strong>
          <span>Core workspace and project features</span>
          <span>EUR 0 / month</span>
        </div>
      </section>
      <section className={styles.card}>
        <CardHeading
          icon={CreditCard}
          subtitle="Plans and payments will appear here when subscriptions are enabled"
          title="Upgrade your plan"
        />
        <p className={styles.mutedCopy}>
          DevFlow is currently available on the Free plan. Billing is not
          connected yet, so no payment details are collected or stored.
        </p>
      </section>
    </>
  );
}
function SetupPanel() {
  const [tokens, setTokens] = useState<
    Array<{
      expiresAt?: string | null;
      id: string;
      lastUsedAt?: string | null;
      name: string;
      scopes: Array<"api:read" | "api:write">;
      tokenPrefix: string;
    }>
  >([]);
  const [secret, setSecret] = useState<string>();
  const [setupError, setSetupError] = useState<string>();
  const [setupMessage, setSetupMessage] = useState<string>();
  const [figmaConfigured, setFigmaConfigured] = useState(false);
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [isLoadingFigma, setIsLoadingFigma] = useState(true);
  const [isDisconnectingFigma, setIsDisconnectingFigma] = useState(false);
  const apiReferenceUrl = getApiAssetUrl("/openapi.json");
  const apiExample = `curl -H "Authorization: Bearer YOUR_TOKEN" \\
  ${getApiAssetUrl("/api/v1/auth/me")}`;

  useEffect(() => {
    void getFigmaConnection()
      .then((response) => {
        setFigmaConfigured(response.configured);
        setFigmaConnected(response.connected);
      })
      .catch(() => setSetupError("Unable to load Figma connection status."))
      .finally(() => setIsLoadingFigma(false));
  }, []);

  useEffect(() => {
    void getApiTokens()
      .then((response) => setTokens(response.tokens))
      .catch(() => setSetupError("Unable to load API tokens."));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSetupError(undefined);
    const form = new FormData(event.currentTarget);
    const days = Number(form.get("expiresInDays") ?? 0);
    const access = String(form.get("access") ?? "read-write");

    try {
      const response = await createApiToken({
        expiresAt: days
          ? new Date(Date.now() + days * 86_400_000).toISOString()
          : null,
        name: String(form.get("name") ?? ""),
        scopes:
          access === "read-only" ? ["api:read"] : ["api:read", "api:write"],
      });
      setSecret(response.token);
      setTokens((current) => [response.tokenInfo, ...current]);
      event.currentTarget.reset();
      setSetupMessage(
        "Token created. Copy it now — it will not be shown again.",
      );
    } catch {
      setSetupError("Unable to create API token.");
    }
  }

  return (
    <>
      <section className={styles.card}>
        <CardHeading
          icon={TerminalSquare}
          subtitle="Connect your personal tools without sharing credentials with your team"
          title="Integrations"
        />
        {setupError ? <p className={styles.error}>{setupError}</p> : null}
        {setupMessage ? <p className={styles.success}>{setupMessage}</p> : null}
        <div className={styles.integrationRow}>
          <Palette aria-hidden="true" size={22} />
          <div>
            <strong>Figma</strong>
            <span>
              {isLoadingFigma
                ? "Checking your connection…"
                : figmaConnected
                  ? "Your Figma account is connected. Its access remains personal."
                  : !figmaConfigured
                    ? "Figma OAuth is not configured for this deployment yet."
                    : "Connect your account to use Figma-powered features."}
            </span>
          </div>
          {figmaConnected ? (
            <button
              className={styles.textButton}
              disabled={isDisconnectingFigma}
              onClick={() => {
                setIsDisconnectingFigma(true);
                void disconnectFigma()
                  .then(() => {
                    setFigmaConnected(false);
                    setSetupMessage("Figma account disconnected.");
                  })
                  .catch(() => setSetupError("Unable to disconnect Figma."))
                  .finally(() => setIsDisconnectingFigma(false));
              }}
              type="button"
            >
              {isDisconnectingFigma ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : figmaConfigured ? (
            <a
              aria-disabled={isLoadingFigma}
              className={styles.secondaryButton}
              href={
                isLoadingFigma
                  ? undefined
                  : (getApiAssetUrl("/api/v1/integrations/figma/connect") ??
                    undefined)
              }
            >
              Connect Figma
            </a>
          ) : (
            <button
              className={styles.secondaryButton}
              disabled
              title="Add the Figma OAuth values to the deployment environment first."
              type="button"
            >
              Figma setup required
            </button>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <CardHeading
          icon={KeyRound}
          subtitle="Create scoped credentials for Codex, scripts, and any supported client"
          title="Developer API"
        />
        <p className={styles.mutedCopy}>
          Create a token only when you explicitly connect DevFlow to another
          program. Tokens can be revoked here at any time and are shown only
          once.
        </p>
        <div className={styles.apiGuide}>
          <div>
            <strong>Connect an external client</strong>
            <span>
              Send the token in the Authorization header. Choose read-only for
              dashboards and reports; use read and write only for clients that
              create or change DevFlow data.
            </span>
          </div>
          <pre>
            <code>{apiExample}</code>
          </pre>
          <div className={styles.apiGuideActions}>
            <button
              className={styles.secondaryButton}
              onClick={() =>
                void navigator.clipboard
                  .writeText(apiExample)
                  .then(() => setSetupMessage("Request example copied."))
                  .catch(() =>
                    setSetupError("Unable to copy the request example."),
                  )
              }
              type="button"
            >
              Copy example
            </button>
            {apiReferenceUrl ? (
              <a
                className={styles.textLink}
                href={apiReferenceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open OpenAPI reference
              </a>
            ) : null}
          </div>
        </div>
        {secret ? (
          <p className={styles.success}>
            Copy this token now: <code>{secret}</code>
            <button
              className={styles.textButton}
              onClick={() =>
                void navigator.clipboard
                  .writeText(secret)
                  .then(() => setSetupMessage("Token copied."))
              }
              type="button"
            >
              Copy
            </button>
          </p>
        ) : null}
        <form className={styles.form} onSubmit={(event) => void create(event)}>
          <label>
            <span>Token name</span>
            <input maxLength={80} name="name" required />
          </label>
          <label>
            <span>Expires</span>
            <select name="expiresInDays">
              <option value="0">Never</option>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
            </select>
          </label>
          <label>
            <span>Access</span>
            <select defaultValue="read-write" name="access">
              <option value="read-write">Read and write</option>
              <option value="read-only">Read only</option>
            </select>
          </label>
          <div className={styles.formFooter}>
            <span />
            <button className={styles.primaryButton} type="submit">
              Create API token
            </button>
          </div>
        </form>
        <ul className={styles.sessionList}>
          {tokens.map((token) => (
            <li key={token.id}>
              <div>
                <strong>
                  {token.name} · {token.tokenPrefix}…
                </strong>
                <span>
                  {token.expiresAt
                    ? `Expires ${new Date(token.expiresAt).toLocaleDateString()}`
                    : "Never expires"}
                  {token.lastUsedAt
                    ? ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                    : " · Never used"}
                  {` · ${token.scopes.includes("api:write") ? "Read and write" : "Read only"}`}
                </span>
              </div>
              <button
                className={styles.textButton}
                onClick={() =>
                  void revokeApiToken(token.id).then(() =>
                    setTokens((current) =>
                      current.filter((item) => item.id !== token.id),
                    ),
                  )
                }
                type="button"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
function AiPanel() {
  const [settings, setSettings] = useState<{
    configured: boolean;
    model: string | null;
    provider: "anthropic" | "openai" | null;
    updatedAt: string | null;
  }>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getAiSettings()
      .then(setSettings)
      .catch(() => setError("Unable to load AI settings."));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);
    setIsSaving(true);
    const form = new FormData(event.currentTarget);

    try {
      const result = await updateAiSettings({
        apiKey: String(form.get("apiKey") ?? ""),
        model: String(form.get("model") ?? "").trim() || null,
        provider: String(form.get("provider")) as "anthropic" | "openai",
      });
      setSettings(result);
      event.currentTarget.reset();
      setMessage("AI provider settings saved. Your API key is encrypted.");
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to save AI settings.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <CardHeading
        icon={Bot}
        subtitle="Use your personal provider key for future DevFlow AI features"
        title="AI provider"
      />
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.success}>{message}</p> : null}
      {settings?.configured ? (
        <div className={styles.infoRow}>
          <span>
            Connected:{" "}
            {settings.provider === "anthropic" ? "Anthropic" : "OpenAI"}
            {settings.model ? ` · ${settings.model}` : " · default model"}
          </span>
          <button
            className={styles.textButton}
            onClick={() =>
              void deleteAiSettings()
                .then(() => {
                  setSettings({
                    configured: false,
                    model: null,
                    provider: null,
                    updatedAt: null,
                  });
                  setMessage("AI provider settings removed.");
                })
                .catch(() => setError("Unable to remove AI settings."))
            }
            type="button"
          >
            Remove
          </button>
        </div>
      ) : null}
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <label>
          <span>Provider</span>
          <select
            defaultValue={settings?.provider ?? "anthropic"}
            name="provider"
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label>
          <span>Model (optional)</span>
          <input
            defaultValue={settings?.model ?? ""}
            maxLength={160}
            name="model"
            placeholder="Use provider default"
          />
        </label>
        <label>
          <span>API key</span>
          <input
            autoComplete="off"
            minLength={8}
            name="apiKey"
            placeholder={
              settings?.configured
                ? "Enter a new key to replace the current one"
                : "Paste your provider API key"
            }
            required
            type="password"
          />
        </label>
        <p className={styles.mutedCopy}>
          The key is encrypted on the server and is never returned after saving.
        </p>
        <div className={styles.formFooter}>
          <span />
          <button
            className={styles.primaryButton}
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving…" : "Save AI settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
function DataPanel(props: {
  isDeletingAccount: boolean;
  onDeleteAccount: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <>
      <section className={styles.card}>
        <CardHeading
          icon={Download}
          subtitle="Download a copy of your current account information"
          title="Export data"
        />
        <a
          className={styles.secondaryButton}
          href={getAccountDataExportUrl() ?? undefined}
          type="button"
        >
          <Download aria-hidden="true" size={17} />
          Export as JSON
        </a>
        <p className={styles.mutedCopy}>
          The export includes your profile plus accessible workspaces, projects,
          and tasks. Passwords, sessions, and tokens are never included.
        </p>
      </section>
      <section className={`${styles.card} ${styles.dangerCard}`}>
        <CardHeading
          icon={Database}
          subtitle="Permanently remove your account and personal workspace"
          title="Delete account"
        />
        <p className={styles.mutedCopy}>
          This cannot be undone. If you own a workspace with other active
          members, transfer ownership first from its team settings.
        </p>
        <form
          className={`${styles.form} ${styles.dangerForm}`}
          onSubmit={(event) => void props.onDeleteAccount(event)}
        >
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
            <span>Type DELETE to confirm</span>
            <input
              autoComplete="off"
              maxLength={6}
              name="confirmation"
              required
            />
          </label>
          <div className={styles.formFooter}>
            <span />
            <button
              className={styles.dangerButton}
              disabled={props.isDeletingAccount}
              type="submit"
            >
              {props.isDeletingAccount ? "Deleting account" : "Delete account"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function CardHeading({
  icon: Icon,
  subtitle,
  title,
}: {
  icon: LucideIcon;
  subtitle: string;
  title: string;
}) {
  return (
    <div className={styles.cardHeading}>
      <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Avatar({ large = false, user }: { large?: boolean; user: AuthUser }) {
  return (
    <span
      aria-label={user.displayName}
      className={large ? styles.largeAvatar : styles.avatar}
    >
      {user.avatarUrl ? (
        <Image
          alt=""
          height={large ? 112 : 56}
          src={getApiAssetUrl(user.avatarUrl)!}
          unoptimized
          width={large ? 112 : 56}
        />
      ) : (
        initials(user.displayName)
      )}
    </span>
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
function sectionDescription(section: SettingsSection) {
  return {
    profile: "Your profile, photo and email address",
    security: "Password and account protection",
    billing: "Plan and subscription information",
    setup: "Developer tools and integrations",
    ai: "AI provider preferences",
    data: "Export and account data controls",
  }[section];
}
function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

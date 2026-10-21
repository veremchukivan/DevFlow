"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import {
  ApiClientError,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "@/lib/api-client";
import styles from "@/components/ui.module.css";

type RecoveryMode = "request" | "reset" | "verify";

export function AuthRecovery({
  mode,
  token,
}: {
  mode: RecoveryMode;
  token?: string;
}) {
  const [error, setError] = useState<string>();
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const title =
    mode === "request"
      ? "Reset your password"
      : mode === "reset"
        ? "Choose a new password"
        : "Verify your email";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      if (mode === "request") {
        await requestPasswordReset({ email: String(form.get("email") ?? "") });
      } else if (mode === "reset") {
        await resetPassword({
          password: String(form.get("password") ?? ""),
          token: token ?? "",
        });
      } else {
        await verifyEmail({ token: token ?? "" });
      }
      setIsComplete(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to complete this request. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.authPanel} aria-labelledby="recovery-title">
        <div className={styles.authBrand}>DevFlow</div>
        <h1 id="recovery-title">
          {isComplete
            ? mode === "verify"
              ? "Email verified"
              : "Check your email"
            : title}
        </h1>
        <p className={styles.authSubtitle}>
          {isComplete
            ? mode === "reset"
              ? "Your password has been updated."
              : "You can now continue with DevFlow."
            : mode === "request"
              ? "Enter your email and we will send a reset link."
              : "Complete this step to continue."}
        </p>
        {!isComplete ? (
          <form className={styles.authForm} onSubmit={onSubmit}>
            {mode === "request" ? (
              <label>
                <span>Email</span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  maxLength={320}
                  name="email"
                  required
                  type="email"
                />
              </label>
            ) : null}
            {mode === "reset" ? (
              <label>
                <span>New password</span>
                <input
                  autoComplete="new-password"
                  maxLength={256}
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </label>
            ) : null}
            {error ? (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            ) : null}
            <button
              className={styles.primaryButton}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Please wait"
                : mode === "verify"
                  ? "Verify email"
                  : mode === "reset"
                    ? "Update password"
                    : "Send reset link"}
            </button>
          </form>
        ) : null}
        <p className={styles.authSwitch}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

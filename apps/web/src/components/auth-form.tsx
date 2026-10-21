"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ApiClientError, login, register } from "@/lib/api-client";
import styles from "@/components/ui.module.css";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      if (isRegister) {
        await register({
          displayName: String(form.get("displayName") ?? ""),
          email,
          password,
        });
      } else {
        await login({ email, password });
      }

      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      if (caughtError instanceof ApiClientError) {
        setError(caughtError.message);
      } else {
        setError(
          "Unable to reach DevFlow. Check the API connection and try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.authPanel} aria-labelledby="auth-title">
        <div className={styles.authBrand}>DevFlow</div>
        <h1 id="auth-title">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className={styles.authSubtitle}>
          {isRegister
            ? "Start organizing work with your team."
            : "Sign in to continue to your workspace."}
        </p>

        <form className={styles.authForm} onSubmit={onSubmit}>
          {isRegister ? (
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                maxLength={120}
                name="displayName"
                required
              />
            </label>
          ) : null}
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
          <label>
            <span>Password</span>
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              maxLength={256}
              minLength={isRegister ? 8 : 1}
              name="password"
              required
              type="password"
            />
          </label>

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
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className={styles.authSwitch}>
          {isRegister ? "Already have an account?" : "New to DevFlow?"}{" "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {!isRegister ? (
          <p className={styles.authSwitch}>
            <Link href="/forgot-password">Forgot your password?</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}

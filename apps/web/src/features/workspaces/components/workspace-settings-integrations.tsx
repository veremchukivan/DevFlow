"use client";

import { Bot, Boxes, Palette, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getAiSettings, getFigmaConnection } from "@/shared/lib/api-client";

import styles from "./workspace-settings-pages.module.css";

export function WorkspaceSettingsIntegrations({
  toolchain = false,
}: {
  toolchain?: boolean;
}) {
  const [figma, setFigma] = useState<{
    configured: boolean;
    connected: boolean;
  }>();
  const [ai, setAi] = useState<{
    configured: boolean;
    provider: string | null;
  }>();
  useEffect(() => {
    void getFigmaConnection()
      .then(setFigma)
      .catch(() => undefined);
    void getAiSettings()
      .then((value) =>
        setAi({ configured: value.configured, provider: value.provider }),
      )
      .catch(() => undefined);
  }, []);
  return (
    <>
      <header className={styles.header}>
        <p>Workspace settings / {toolchain ? "Toolchain" : "Apps"}</p>
        <h1>{toolchain ? "Toolchain" : "Apps"}</h1>
        <span>
          {toolchain
            ? "Connect the personal developer tools used by workspace members."
            : "Review available integrations and connected services."}
        </span>
      </header>
      <div className={styles.integrationGrid}>
        <article className={styles.integrationCard}>
          <Palette size={24} />
          <h2>Figma</h2>
          <p>
            {figma
              ? figma.connected
                ? "Connected personally. Links can be attached to projects and tasks."
                : figma.configured
                  ? "Available to connect from your Setup profile."
                  : "OAuth has not been configured for this deployment."
              : "Checking connection…"}
          </p>
          <Link href="/profile?section=setup">Open Setup</Link>
        </article>
        <article className={styles.integrationCard}>
          <Bot size={24} />
          <h2>AI provider</h2>
          <p>
            {ai?.configured
              ? `${ai.provider === "anthropic" ? "Anthropic" : "OpenAI"} is configured for your account.`
              : "Use your own encrypted provider key for future AI features."}
          </p>
          <Link href="/profile?section=ai">Open AI settings</Link>
        </article>
        {toolchain ? (
          <article className={styles.integrationCard}>
            <TerminalSquare size={24} />
            <h2>Developer setup</h2>
            <p>
              API tokens and DevFlow Runner are managed in your personal Setup
              profile.
            </p>
            <Link href="/profile?section=setup">Manage API tokens</Link>
          </article>
        ) : (
          <article className={styles.integrationCard}>
            <Boxes size={24} />
            <h2>More apps</h2>
            <p>
              Calendar, Google Docs, Sheets and communication apps are planned
              as workspace integrations.
            </p>
          </article>
        )}
      </div>
    </>
  );
}

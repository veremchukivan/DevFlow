"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  ApiClientError,
  deleteWorkspaceIcon,
  getApiAssetUrl,
  getWorkspace,
  getWorkspaceMembers,
  getWorkspaceSettings,
  updateWorkspace,
  updateWorkspaceSettings,
  uploadWorkspaceIcon,
} from "@/shared/lib/api-client";
import { notifyWorkspacesChanged } from "@/shared/lib/workspace-events";
import type { Workspace, WorkspaceMember } from "@devflow/shared";

import styles from "./workspace-settings-pages.module.css";

const supportedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export function WorkspaceSettingsDetails() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [workspace, setWorkspace] = useState<Workspace>();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [defaultAssigneeUserId, setDefaultAssigneeUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void Promise.all([
      getWorkspace(workspaceId),
      getWorkspaceMembers(workspaceId),
      getWorkspaceSettings(workspaceId),
    ])
      .then(([workspaceResponse, membersResponse, settingsResponse]) => {
        setWorkspace(workspaceResponse.workspace);
        setMembers(
          membersResponse.members.filter((member) => member.status === "active"),
        );
        setDefaultAssigneeUserId(
          settingsResponse.settings.defaultAssigneeUserId ?? "",
        );
      })
      .catch(() => setError("Unable to load workspace settings."));
  }, [workspaceId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    setSaved(false);

    const form = new FormData(event.currentTarget);
    try {
      const response = await updateWorkspace(workspaceId, {
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
      });
      await updateWorkspaceSettings(workspaceId, {
        defaultAssigneeUserId: defaultAssigneeUserId || null,
      });
      setWorkspace(response.workspace);
      notifyWorkspacesChanged();
      setSaved(true);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Unable to save workspace details."));
    } finally {
      setSaving(false);
    }
  }

  async function onImageChange(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;
    if (!supportedImageTypes.includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }

    setSavingImage(true);
    setError(undefined);
    setSaved(false);
    try {
      const response = await uploadWorkspaceIcon(workspaceId, file);
      setWorkspace(response.workspace);
      notifyWorkspacesChanged();
      setSaved(true);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Unable to upload workspace image."));
    } finally {
      setSavingImage(false);
    }
  }

  async function onRemoveImage() {
    setSavingImage(true);
    setError(undefined);
    setSaved(false);
    try {
      const response = await deleteWorkspaceIcon(workspaceId);
      setWorkspace(response.workspace);
      notifyWorkspacesChanged();
      setSaved(true);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Unable to remove workspace image."));
    } finally {
      setSavingImage(false);
    }
  }

  if (!workspace) {
    return <p className={styles.loading}>{error ?? "Loading details"}</p>;
  }

  const workspaceImageUrl = getApiAssetUrl(workspace.iconUrl);

  return (
    <>
      <header className={styles.header}>
        <p>Workspace settings / Details</p>
        <h1>Details</h1>
        <span>Update the name, image, and address used across this workspace.</span>
      </header>

      <form className={styles.form} onSubmit={onSubmit}>
        <section aria-label="Workspace image" className={styles.imageSection}>
          <div className={styles.iconPreview}>
            {workspaceImageUrl ? (
              <Image
                alt={`Workspace image for ${workspace.name}`}
                fill
                sizes="126px"
                src={workspaceImageUrl}
                unoptimized
              />
            ) : (
              workspace.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className={styles.imageActions}>
            <input
              accept="image/jpeg,image/png,image/webp"
              className={styles.visuallyHidden}
              onChange={onImageChange}
              ref={imageInputRef}
              type="file"
            />
            <button
              className={styles.secondaryButton}
              disabled={savingImage}
              onClick={() => imageInputRef.current?.click()}
              type="button"
            >
              {savingImage
                ? "Uploading"
                : workspace.iconUrl
                  ? "Change image"
                  : "Upload image"}
            </button>
            {workspace.iconUrl ? (
              <button
                className={styles.removeButton}
                disabled={savingImage}
                onClick={onRemoveImage}
                type="button"
              >
                Remove
              </button>
            ) : null}
            <p>PNG, JPEG, or WebP. Maximum size 2 MB.</p>
          </div>
        </section>

        <label>
          <span>Workspace name</span>
          <input
            defaultValue={workspace.name}
            maxLength={120}
            minLength={2}
            name="name"
            required
          />
        </label>
        <label>
          <span>Workspace URL</span>
          <input
            defaultValue={workspace.slug}
            maxLength={80}
            name="slug"
            required
          />
        </label>
        <label>
          <span>Default assignee</span>
          <select
            onChange={(event) => setDefaultAssigneeUserId(event.target.value)}
            value={defaultAssigneeUserId}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user.displayName}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        {saved ? <p className={styles.saved}>Details saved.</p> : null}
        <button disabled={saving} type="submit">
          {saving ? "Saving" : "Save changes"}
        </button>
      </form>
    </>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

"use client";

import { Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import {
  createWorkspaceSavedFilter,
  deleteWorkspaceSavedFilter,
  getWorkspaceMembers,
  getWorkspaceSavedFilters,
  getWorkspaceSettings,
  updateWorkspaceSettings,
} from "@/shared/lib/api-client";
import styles from "./workspace-settings-pages.module.css";

const types = ["task", "bug", "feature", "story"] as const;
const featureCopy = {
  attachments: "Attachments",
  automation: "Automation",
  sprints: "Sprints",
} as const;
const filterPriorities = ["low", "medium", "high", "urgent"] as const;
const dueOptions = ["overdue", "today", "week", "none"] as const;

export function WorkspaceSettingsConfiguration({
  section,
}: {
  section: "fields" | "work-types" | "features" | "filters";
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [settings, setSettings] =
    useState<Awaited<ReturnType<typeof getWorkspaceSettings>>["settings"]>();
  const [filters, setFilters] = useState<
    Awaited<ReturnType<typeof getWorkspaceSavedFilters>>["filters"]
  >([]);
  const [error, setError] = useState<string>();
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssigneeUserId, setFilterAssigneeUserId] = useState("");
  const [filterDue, setFilterDue] = useState("");
  const [members, setMembers] = useState<
    Awaited<ReturnType<typeof getWorkspaceMembers>>["members"]
  >([]);
  useEffect(() => {
    void getWorkspaceSettings(workspaceId)
      .then((value) => setSettings(value.settings))
      .catch(() => setError("Unable to load workspace settings."));
    if (section === "filters")
      void Promise.all([
        getWorkspaceSavedFilters(workspaceId),
        getWorkspaceMembers(workspaceId),
      ])
        .then(([filtersResponse, membersResponse]) => {
          setFilters(filtersResponse.filters);
          setMembers(
            membersResponse.members.filter((member) => member.status === "active"),
          );
        })
        .catch(() => setError("Unable to load saved filters."));
  }, [section, workspaceId]);
  async function save(input: Parameters<typeof updateWorkspaceSettings>[1]) {
    try {
      const value = await updateWorkspaceSettings(workspaceId, input);
      setSettings(value.settings);
    } catch {
      setError("Unable to save workspace settings.");
    }
  }
  if (section === "filters")
    return (
      <>
        <Header
          title="Custom filters"
          text="Save reusable task filters for this workspace."
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <form
          className={styles.inlineForm}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const criteria = {
              ...(filterPriority ? { priority: filterPriority } : {}),
              ...(filterAssigneeUserId
                ? { assigneeUserId: filterAssigneeUserId }
                : {}),
              ...(filterDue ? { due: filterDue } : {}),
            };
            void createWorkspaceSavedFilter(workspaceId, {
              name: String(form.get("name")),
              criteria,
            })
              .then((value) => {
                setFilters((current) => [value.filter, ...current]);
                event.currentTarget.reset();
                setFilterPriority("");
                setFilterAssigneeUserId("");
                setFilterDue("");
              })
              .catch(() => setError("Unable to save filter."));
          }}
        >
          <input name="name" placeholder="Filter name" required />
          <select
            aria-label="Priority"
            onChange={(event) => setFilterPriority(event.target.value)}
            value={filterPriority}
          >
            <option value="">Any priority</option>
            {filterPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority[0]!.toUpperCase() + priority.slice(1)} priority
              </option>
            ))}
          </select>
          <select
            aria-label="Assignee"
            onChange={(event) => setFilterAssigneeUserId(event.target.value)}
            value={filterAssigneeUserId}
          >
            <option value="">Any assignee</option>
            <option value="none">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user.displayName}
              </option>
            ))}
          </select>
          <select
            aria-label="Due date"
            onChange={(event) => setFilterDue(event.target.value)}
            value={filterDue}
          >
            <option value="">Any due date</option>
            {dueOptions.map((due) => (
              <option key={due} value={due}>
                {due === "week" ? "This week" : due === "none" ? "No due date" : due[0]!.toUpperCase() + due.slice(1)}
              </option>
            ))}
          </select>
          <button type="submit">
            <Plus size={16} />
            Save filter
          </button>
        </form>
        <div className={styles.itemList}>
          {filters.map((filter) => (
            <div key={filter.id}>
              <span>
                <strong>{filter.name}</strong>
                <small>{describeFilter(filter.criteria, members)}</small>
              </span>
              <button
                onClick={() =>
                  void deleteWorkspaceSavedFilter(workspaceId, filter.id)
                    .then(() =>
                      setFilters((items) =>
                        items.filter((item) => item.id !== filter.id),
                      ),
                    )
                    .catch(() => setError("Unable to remove filter."))
                }
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  if (!settings) return <p className={styles.loading}>Loading settings</p>;
  if (section === "work-types")
    return (
      <>
        <Header
          title="Work types"
          text="Choose which built-in work types can be used in this workspace."
        />
        <div className={styles.itemList}>
          {types.map((type) => (
            <label key={type}>
              <span>{type.slice(0, 1).toUpperCase() + type.slice(1)}</span>
              <input
                checked={settings.enabledTaskTypes.includes(type)}
                onChange={() => {
                  const enabledTaskTypes = settings.enabledTaskTypes.includes(
                    type,
                  )
                    ? settings.enabledTaskTypes.filter(
                        (value) => value !== type,
                      )
                    : [...settings.enabledTaskTypes, type];
                  if (enabledTaskTypes.length) void save({ enabledTaskTypes });
                }}
                type="checkbox"
              />
            </label>
          ))}
        </div>
      </>
    );
  if (section === "features")
    return (
      <>
        <Header
          title="Features"
          text="Enable workspace capabilities for all projects."
        />
        <div className={styles.itemList}>
          {(Object.keys(featureCopy) as Array<keyof typeof featureCopy>).map(
            (key) => (
              <label key={key}>
                <span>{featureCopy[key]}</span>
                <input
                  checked={settings.features[key]}
                  onChange={() =>
                    void save({
                      features: {
                        ...settings.features,
                        [key]: !settings.features[key],
                      },
                    })
                  }
                  type="checkbox"
                />
              </label>
            ),
          )}
        </div>
      </>
    );
  return (
    <>
      <Header
        title="Fields"
        text="Create definitions for custom task information in this workspace."
      />
      <form
        className={styles.inlineForm}
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = String(form.get("name")).trim();
          const type = form.get("type") as "number" | "select" | "text";
          const options = String(form.get("options") ?? "")
            .split(",")
            .map((option) => option.trim())
            .filter((option, index, values) => option && values.indexOf(option) === index);
          if (type === "select" && !options.length) {
            setError("Select fields need at least one option.");
            return;
          }
          if (!name) return;
          void save({
            customFields: [
              ...settings.customFields,
              { id: crypto.randomUUID(), name, options, type },
            ],
          });
          event.currentTarget.reset();
        }}
      >
        <input name="name" placeholder="Field name" required />
        <select defaultValue="text" name="type">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select</option>
        </select>
        <input name="options" placeholder="Options, separated by commas" />
        <button type="submit">
          <Plus size={16} />
          Add field
        </button>
      </form>
      <div className={styles.itemList}>
        {settings.customFields.map((field) => (
          <div key={field.id}>
            <span className={styles.customFieldDetails}>
              <strong>{field.name} <small>{field.type}</small></strong>
              {field.type === "select" ? (
                <input
                  aria-label={`${field.name} options`}
                  defaultValue={field.options.join(", ")}
                  onBlur={(event) => {
                    const options = event.currentTarget.value
                      .split(",")
                      .map((option) => option.trim())
                      .filter((option, index, values) => option && values.indexOf(option) === index);
                    if (!options.length) {
                      setError("Select fields need at least one option.");
                      return;
                    }
                    void save({
                      customFields: settings.customFields.map((item) =>
                        item.id === field.id ? { ...item, options } : item,
                      ),
                    });
                  }}
                  placeholder="Options, separated by commas"
                />
              ) : null}
            </span>
            <button
              onClick={() =>
                void save({
                  customFields: settings.customFields.filter(
                    (item) => item.id !== field.id,
                  ),
                })
              }
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function describeFilter(
  criteria: Record<string, unknown>,
  members: Awaited<ReturnType<typeof getWorkspaceMembers>>["members"],
) {
  const description = [
    typeof criteria.priority === "string" ? `${criteria.priority} priority` : "",
    criteria.assigneeUserId === "none"
      ? "unassigned"
      : typeof criteria.assigneeUserId === "string"
        ? members.find((member) => member.userId === criteria.assigneeUserId)?.user
            .displayName ?? "assigned member"
        : "",
    typeof criteria.due === "string"
      ? criteria.due === "week"
        ? "this week"
        : criteria.due
      : "",
  ].filter(Boolean);
  return description.length ? description.join(" · ") : "All tasks";
}

function Header({ text, title }: { text: string; title: string }) {
  return (
    <header className={styles.header}>
      <p>Workspace settings</p>
      <h1>{title}</h1>
      <span>{text}</span>
    </header>
  );
}

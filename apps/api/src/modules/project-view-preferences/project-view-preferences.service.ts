import type {
  ProjectViewPreferences,
  UpdateProjectViewPreferencesRequest,
} from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import {
  findAccessibleProject,
  findProjectViewPreferences,
  saveProjectViewPreferences,
} from "./project-view-preferences.repository.js";

const defaults: ProjectViewPreferences = {
  activityLimit: 1,
  boardScrolling: "board",
  columnSize: "flexible",
  columnWidths: {},
  hideDoneTasks: false,
  visibleTaskFields: [
    "assignee",
    "dueDate",
    "labels",
    "priority",
    "taskKey",
    "taskType",
  ],
};

export async function getProjectViewPreferences(input: {
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireProjectAccess(input);
  const preferences = await findProjectViewPreferences(input);
  return toPreferences(preferences);
}

export async function updateProjectViewPreferences(input: {
  input: UpdateProjectViewPreferencesRequest;
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireProjectAccess(input);
  const existing = await findProjectViewPreferences(input);
  return toPreferences(
    await saveProjectViewPreferences({
      ...input,
      preferences: { ...toPreferences(existing), ...input.input },
    }),
  );
}

async function requireProjectAccess(input: {
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  if (!(await findAccessibleProject(input))) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }
}

function toPreferences(
  preferences: Awaited<ReturnType<typeof findProjectViewPreferences>>,
): ProjectViewPreferences {
  if (!preferences) return defaults;
  return {
    activityLimit: preferences.activityLimit,
    boardScrolling:
      preferences.boardScrolling as ProjectViewPreferences["boardScrolling"],
    columnSize: preferences.columnSize as ProjectViewPreferences["columnSize"],
    columnWidths: preferences.columnWidths as Record<string, number>,
    hideDoneTasks: preferences.hideDoneTasks,
    visibleTaskFields:
      preferences.visibleTaskFields as ProjectViewPreferences["visibleTaskFields"],
  };
}

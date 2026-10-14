import type { CreateProjectRequest } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { canCreateProject } from "./projects.policy.js";
import {
  createProjectWithDefaultStatuses,
  findActiveWorkspaceMembership,
  findProjectByKey,
  findProjectInWorkspace,
  listProjectsForWorkspace,
  listProjectStatuses
} from "./projects.repository.js";

const maxProjectKeyAttempts = 10;

export async function createProject(input: {
  input: CreateProjectRequest;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canCreateProject(membership.role)) {
    throw new AppError(
      403,
      "PROJECT_CREATE_FORBIDDEN",
      "You cannot create projects in this workspace"
    );
  }

  const key = await buildAvailableProjectKey({
    key: input.input.key,
    name: input.input.name,
    workspaceId: input.workspaceId
  });

  try {
    return await createProjectWithDefaultStatuses({
      description: input.input.description,
      key,
      name: input.input.name,
      ownerUserId: input.userId,
      workspaceId: input.workspaceId
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "PROJECT_KEY_TAKEN",
        "A project with this key already exists in this workspace"
      );
    }

    throw error;
  }
}

export async function listProjects(input: {
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);

  return listProjectsForWorkspace(input.workspaceId);
}

export async function getProject(input: {
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);

  const project = await findProjectInWorkspace(input);

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  const statuses = await listProjectStatuses(input);

  return {
    ...project,
    statuses
  };
}

async function requireWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const membership = await findActiveWorkspaceMembership(input);

  if (!membership) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }

  return membership;
}

async function buildAvailableProjectKey(input: {
  key?: string;
  name: string;
  workspaceId: string;
}) {
  const baseKey = input.key ?? keyFromName(input.name);

  for (let attempt = 0; attempt < maxProjectKeyAttempts; attempt += 1) {
    const key = withAttemptSuffix(baseKey, attempt);
    const existingProject = await findProjectByKey({
      key,
      workspaceId: input.workspaceId
    });

    if (!existingProject) {
      return key;
    }
  }

  throw new AppError(
    409,
    "PROJECT_KEY_TAKEN",
    "A project with this key already exists in this workspace"
  );
}

function keyFromName(name: string) {
  const letters = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);

  if (letters.length >= 2 && /^[A-Z]/.test(letters)) {
    return letters;
  }

  return "PR";
}

function withAttemptSuffix(baseKey: string, attempt: number) {
  if (attempt === 0) {
    return baseKey;
  }

  const suffix = String(attempt + 1);
  return `${baseKey.slice(0, 12 - suffix.length)}${suffix}`;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

import type {
  CreateProjectRequest,
  PaginationQuery,
  UpdateProjectRequest
} from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import {
  canCreateProject,
  canDeleteProject,
  canUpdateProject
} from "./projects.policy.js";
import {
  createProjectWithDefaultStatuses,
  findActiveWorkspaceMembership,
  findProjectByKey,
  findProjectInWorkspace,
  listProjectsForWorkspace,
  listProjectStatuses,
  softDeleteProjectInDb,
  updateProjectInDb
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
  pagination: PaginationQuery;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);

  const result = await listProjectsForWorkspace({
    pagination: input.pagination,
    workspaceId: input.workspaceId
  });

  return {
    pageInfo: buildPageInfo({
      ...input.pagination,
      total: result.total
    }),
    projects: result.projects
  };
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

export async function updateProject(input: {
  input: UpdateProjectRequest;
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canUpdateProject(membership.role)) {
    throw new AppError(
      403,
      "PROJECT_UPDATE_FORBIDDEN",
      "You cannot update projects in this workspace"
    );
  }

  const existingProject = await findProjectInWorkspace(input);

  if (!existingProject) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  let key = existingProject.key;
  if (input.input.key && input.input.key !== existingProject.key) {
    const keyTaken = await findProjectByKey({
      key: input.input.key,
      workspaceId: input.workspaceId
    });

    if (keyTaken && keyTaken.id !== input.projectId) {
      throw new AppError(
        409,
        "PROJECT_KEY_TAKEN",
        "A project with this key already exists in this workspace"
      );
    }
    key = input.input.key;
  }

  try {
    const updated = await updateProjectInDb({
      description: input.input.description,
      key: input.input.key ? key : undefined,
      name: input.input.name,
      projectId: input.projectId,
      workspaceId: input.workspaceId
    });

    if (!updated) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const statuses = await listProjectStatuses(input);

    return {
      ...updated,
      statuses
    };
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

export async function deleteProject(input: {
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canDeleteProject(membership.role)) {
    throw new AppError(
      403,
      "PROJECT_DELETE_FORBIDDEN",
      "You cannot delete projects in this workspace"
    );
  }

  const existingProject = await findProjectInWorkspace(input);

  if (!existingProject) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  const deleted = await softDeleteProjectInDb(input);

  if (!deleted) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }
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

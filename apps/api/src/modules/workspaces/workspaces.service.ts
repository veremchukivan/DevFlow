import { randomBytes } from "node:crypto";
import type {
  CreateWorkspaceRequest,
  PaginationQuery,
  UpdateWorkspaceRequest
} from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import {
  canDeleteWorkspace,
  canUpdateWorkspace
} from "./workspaces.policy.js";
import {
  createWorkspaceWithOwner,
  findWorkspaceBySlug,
  findWorkspaceForUser,
  listWorkspacesForUser,
  softDeleteWorkspaceInDb,
  updateWorkspaceInDb
} from "./workspaces.repository.js";

const maxSlugAttempts = 10;

export async function createWorkspace(
  ownerUserId: string,
  input: CreateWorkspaceRequest
) {
  const slug = await buildAvailableSlug(input.slug ?? input.name);

  try {
    return await createWorkspaceWithOwner({
      name: input.name,
      ownerUserId,
      slug
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "WORKSPACE_SLUG_TAKEN",
        "A workspace with this slug already exists"
      );
    }

    throw error;
  }
}

export async function listWorkspaces(input: {
  pagination: PaginationQuery;
  userId: string;
}) {
  const result = await listWorkspacesForUser(input);

  return {
    pageInfo: buildPageInfo({
      ...input.pagination,
      total: result.total
    }),
    workspaces: result.workspaces
  };
}

export async function getWorkspace(userId: string, workspaceId: string) {
  const workspace = await findWorkspaceForUser({ userId, workspaceId });

  if (!workspace) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }

  return workspace;
}

export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  input: UpdateWorkspaceRequest
) {
  const workspace = await findWorkspaceForUser({ userId, workspaceId });

  if (!workspace) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }

  if (!canUpdateWorkspace(workspace.role)) {
    throw new AppError(
      403,
      "WORKSPACE_UPDATE_FORBIDDEN",
      "You cannot update this workspace"
    );
  }

  let slug = workspace.slug;
  if (input.slug && input.slug !== workspace.slug) {
    const existing = await findWorkspaceBySlug(input.slug);
    if (existing && existing.id !== workspaceId) {
      throw new AppError(
        409,
        "WORKSPACE_SLUG_TAKEN",
        "A workspace with this slug already exists"
      );
    }
    slug = input.slug;
  }

  try {
    const updated = await updateWorkspaceInDb({
      name: input.name,
      slug: input.slug ? slug : undefined,
      workspaceId
    });

    if (!updated) {
      throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
    }

    return {
      ...updated,
      role: workspace.role
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "WORKSPACE_SLUG_TAKEN",
        "A workspace with this slug already exists"
      );
    }

    throw error;
  }
}

export async function deleteWorkspace(userId: string, workspaceId: string) {
  const workspace = await findWorkspaceForUser({ userId, workspaceId });

  if (!workspace) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }

  if (!canDeleteWorkspace(workspace.role)) {
    throw new AppError(
      403,
      "WORKSPACE_DELETE_FORBIDDEN",
      "Only workspace owners can delete a workspace"
    );
  }

  const deleted = await softDeleteWorkspaceInDb(workspaceId);

  if (!deleted) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
}

async function buildAvailableSlug(input: string) {
  const baseSlug = slugify(input);

  for (let attempt = 0; attempt < maxSlugAttempts; attempt += 1) {
    const slug = withAttemptSuffix(baseSlug, attempt);
    const existingWorkspace = await findWorkspaceBySlug(slug);

    if (!existingWorkspace) {
      return slug;
    }
  }

  // Fallback: append a random 6-character hex suffix to prevent 409 conflict
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const randomSuffix = `-${randomBytes(3).toString("hex")}`;
    const slug = `${baseSlug.slice(0, 80 - randomSuffix.length)}${randomSuffix}`;
    const existingWorkspace = await findWorkspaceBySlug(slug);

    if (!existingWorkspace) {
      return slug;
    }
  }

  throw new AppError(
    409,
    "WORKSPACE_SLUG_TAKEN",
    "A workspace with this slug already exists"
  );
}

function slugify(input: string) {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");

  if (cleaned.length >= 3) {
    return cleaned;
  }

  if (cleaned.length > 0) {
    const candidate = `${cleaned}-workspace`;
    return candidate.slice(0, 80).replace(/-+$/g, "");
  }

  return "workspace";
}

function withAttemptSuffix(baseSlug: string, attempt: number) {
  if (attempt === 0) {
    return baseSlug;
  }

  const suffix = `-${attempt + 1}`;
  return `${baseSlug.slice(0, 80 - suffix.length)}${suffix}`;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

import type { UpdateWorkspaceSettingsRequest } from "@devflow/shared";
import { AppError } from "../../core/errors/app-error.js";
import { canUpdateWorkspace } from "../workspaces/workspaces.policy.js";
import { findWorkspaceForUser } from "../workspaces/workspaces.repository.js";
import * as repository from "./workspace-settings.repository.js";
async function workspace(input: { userId: string; workspaceId: string }) { const item = await findWorkspaceForUser(input); if (!item) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found"); return item; }
export async function getSettings(input: { userId: string; workspaceId: string }) { await workspace(input); return repository.getWorkspaceSettings(input.workspaceId); }
export async function updateSettings(input: { input: UpdateWorkspaceSettingsRequest; userId: string; workspaceId: string }) { const item = await workspace(input); if (!canUpdateWorkspace(item.role)) throw new AppError(403, "WORKSPACE_UPDATE_FORBIDDEN", "You do not have permission to update this workspace"); return repository.saveWorkspaceSettings({ workspaceId: input.workspaceId, ...input.input }); }
export async function getFilters(input: { userId: string; workspaceId: string }) { await workspace(input); return repository.listSavedFilters(input); }
export async function addFilter(input: { criteria: Record<string, unknown>; name: string; userId: string; workspaceId: string }) { await workspace(input); return repository.createSavedFilter(input); }
export async function removeFilter(input: { filterId: string; userId: string; workspaceId: string }) { await workspace(input); if (!(await repository.deleteSavedFilter(input))) throw new AppError(404, "WORKSPACE_FILTER_NOT_FOUND", "Saved filter not found"); }

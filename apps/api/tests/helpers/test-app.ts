import { sql } from "drizzle-orm";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { closeDbConnection, db } from "../../src/core/db/client.js";

export { closeDbConnection, db, request };

export function createTestApp() {
  return createApp();
}

export async function cleanupDatabase() {
  await db.execute(sql`
    TRUNCATE TABLE 
      task_activity_events,
      task_checklist_items,
      task_comments,
      tasks,
      project_statuses,
      projects,
      workspace_invitations,
      workspace_members,
      workspaces,
      sessions,
      users
    CASCADE;
  `);
}

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}_${counter}_${Math.floor(Math.random() * 100000)}`;
}

export async function createTestUser(
  app: ReturnType<typeof createApp>,
  overrides?: {
    displayName?: string;
    email?: string;
    password?: string;
  },
) {
  const suffix = uniqueSuffix();
  const email = overrides?.email ?? `user_${suffix}@devflow.io`;
  const displayName = overrides?.displayName ?? `User ${suffix}`;
  const password = overrides?.password ?? "Password123!";

  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ displayName, email, password });

  if (response.status !== 201) {
    throw new Error(
      `Failed to create test user: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  const setCookie = response.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return {
    cookie,
    displayName,
    email,
    password,
    user: response.body.user as {
      createdAt: string;
      displayName: string;
      email: string;
      id: string;
      isEmailVerified: boolean;
      isPlatformAdmin: boolean;
    },
  };
}

export async function createTestWorkspace(
  app: ReturnType<typeof createApp>,
  cookie: string,
  overrides?: {
    name?: string;
    slug?: string;
  },
) {
  const suffix = uniqueSuffix();
  const name = overrides?.name ?? `Workspace ${suffix}`;
  const slug =
    overrides?.slug ?? `ws-${suffix}`.toLowerCase().replace(/_/g, "-");

  const response = await request(app)
    .post("/api/v1/workspaces")
    .set("Cookie", cookie)
    .send({ name, slug });

  if (response.status !== 201) {
    throw new Error(
      `Failed to create test workspace: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return response.body.workspace as {
    createdAt: string;
    id: string;
    name: string;
    ownerUserId: string;
    role: "owner" | "admin" | "member" | "viewer";
    slug: string;
    updatedAt: string;
  };
}

export async function createTestProject(
  app: ReturnType<typeof createApp>,
  cookie: string,
  workspaceId: string,
  overrides?: {
    description?: string;
    key?: string;
    name?: string;
  },
) {
  const suffix = uniqueSuffix();
  const name = overrides?.name ?? `Project ${suffix}`;
  const key = overrides?.key ?? `PRJ${counter}`.slice(0, 10);

  const response = await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/projects`)
    .set("Cookie", cookie)
    .send({
      description: overrides?.description ?? "Test project description",
      key,
      name,
    });

  if (response.status !== 201) {
    throw new Error(
      `Failed to create test project: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return response.body.project as {
    createdAt: string;
    id: string;
    key: string;
    name: string;
    ownerUserId: string;
    statuses: Array<{
      category: "todo" | "in_progress" | "done";
      color: string;
      id: string;
      name: string;
      position: number;
    }>;
    workspaceId: string;
  };
}

export async function createTestTask(
  app: ReturnType<typeof createApp>,
  cookie: string,
  workspaceId: string,
  projectId: string,
  overrides?: {
    assigneeUserId?: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    statusId?: string;
    title?: string;
  },
) {
  const suffix = uniqueSuffix();
  const title = overrides?.title ?? `Task ${suffix}`;

  const response = await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
    .set("Cookie", cookie)
    .send({
      assigneeUserId: overrides?.assigneeUserId,
      description: overrides?.description,
      priority: overrides?.priority ?? "medium",
      statusId: overrides?.statusId,
      title,
    });

  if (response.status !== 201) {
    throw new Error(
      `Failed to create test task: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return response.body.task as {
    assigneeUserId: string | null;
    createdAt: string;
    id: string;
    key: string;
    number: number;
    priority: "low" | "medium" | "high" | "urgent";
    projectId: string;
    status: {
      category: "todo" | "in_progress" | "done";
      color: string;
      id: string;
      name: string;
      position: number;
    };
    statusId: string;
    title: string;
    updatedAt: string;
    version: number;
    workspaceId: string;
  };
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestProject,
  createTestTask,
  createTestUser,
  createTestWorkspace,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Workspace automation integration tests", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    await cleanupDatabase();
    owner = await createTestUser(app, { email: "automation-owner@devflow.io" });
    member = await createTestUser(app, { email: "automation-member@devflow.io" });
    outsider = await createTestUser(app, { email: "automation-outsider@devflow.io" });
    workspace = await createTestWorkspace(app, owner.cookie, {
      slug: "automation-workspace",
    });
    project = await createTestProject(app, owner.cookie, workspace.id, {
      key: "AUTO",
      name: "Automation project",
    });
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", owner.cookie)
      .send({ email: member.email, role: "member" });
  });

  afterAll(async () => closeDbConnection());

  it("protects templates and creates the three built-in flows", async () => {
    const forbidden = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/automation/templates`)
      .set("Cookie", outsider.cookie);
    expect(forbidden.status).toBe(404);

    const response = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/automation/rules`)
      .set("Cookie", owner.cookie);
    expect(response.status).toBe(200);
    expect(response.body.rules.map((rule: { ruleType: string }) => rule.ruleType)).toEqual(
      expect.arrayContaining([
        "children_completed_close_parent",
        "parent_completed_close_children",
        "task_transition_assign",
      ]),
    );
  });

  it("closes a parent when its final child is completed", async () => {
    await configureOnlyRule("children_completed_close_parent");
    const parent = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { title: "Parent to close" },
    );
    const child = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { parentTaskId: parent.id, title: "Final child" },
    );

    const updated = await transitionToDone(child);
    expect(updated.status).toBe(200);

    const parentAfter = await getTask(parent.id);
    expect(parentAfter.status.category).toBe("done");

    const audit = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/automation/runs`)
      .set("Cookie", owner.cookie);
    expect(audit.body.runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: "succeeded",
          summary: expect.stringContaining("Completed parent work item"),
          triggerTaskId: child.id,
        }),
      ]),
    );
  });

  it("closes unfinished children when their parent is completed", async () => {
    await configureOnlyRule("parent_completed_close_children");
    const parent = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { title: "Completed parent" },
    );
    const child = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { parentTaskId: parent.id, title: "Child to close" },
    );

    const updated = await transitionToDone(parent);
    expect(updated.status).toBe(200);

    const childAfter = await getTask(child.id);
    expect(childAfter.status.category).toBe("done");
  });

  it("assigns the configured workspace member after a transition", async () => {
    await configureOnlyRule("task_transition_assign", {
      assigneeUserId: member.user.id,
      onlyWhenUnassigned: true,
    });
    const task = await createTestTask(
      app,
      owner.cookie,
      workspace.id,
      project.id,
      { title: "Assign on transition" },
    );

    const updated = await transitionToInProgress(task);
    expect(updated.status).toBe(200);

    const taskAfter = await getTask(task.id);
    expect(taskAfter.assigneeUserId).toBe(member.user.id);
  });

  async function configureOnlyRule(
    enabledRuleType:
      | "children_completed_close_parent"
      | "parent_completed_close_children"
      | "task_transition_assign",
    configuration?: Record<string, unknown>,
  ) {
    const rulesResponse = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/automation/rules`)
      .set("Cookie", owner.cookie);
    expect(rulesResponse.status).toBe(200);

    const updates = await Promise.all(
      rulesResponse.body.rules.map(
        (rule: { id: string; ruleType: string }) =>
          request(app)
            .patch(
              `/api/v1/workspaces/${workspace.id}/automation/rules/${rule.id}`,
            )
            .set("Cookie", owner.cookie)
            .send({
              ...(rule.ruleType === enabledRuleType && configuration
                ? { configuration }
                : {}),
              enabled: rule.ruleType === enabledRuleType,
            }),
      ),
    );
    for (const update of updates) {
      expect(update.status).toBe(200);
    }
  }

  async function transitionToDone(task: { id: string; version: number }) {
    const doneStatus = project.statuses.find(
      (status) => status.category === "done",
    );
    if (!doneStatus) throw new Error("Test project has no done status");
    return request(app)
      .patch(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`,
      )
      .set("Cookie", owner.cookie)
      .set("If-Match", `\"${task.version}\"`)
      .send({ statusId: doneStatus.id });
  }

  async function transitionToInProgress(task: { id: string; version: number }) {
    const inProgressStatus = project.statuses.find(
      (status) => status.category === "in_progress",
    );
    if (!inProgressStatus) throw new Error("Test project has no in-progress status");
    return request(app)
      .patch(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`,
      )
      .set("Cookie", owner.cookie)
      .set("If-Match", `\"${task.version}\"`)
      .send({ statusId: inProgressStatus.id });
  }

  async function getTask(taskId: string) {
    const response = await request(app)
      .get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${taskId}`,
      )
      .set("Cookie", owner.cookie);
    expect(response.status).toBe(200);
    return response.body.task as {
      assigneeUserId: string | null;
      status: { category: string };
    };
  }
});

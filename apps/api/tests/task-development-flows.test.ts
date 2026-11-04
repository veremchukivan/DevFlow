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

describe("Task Development Flow integration tests", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let task: Awaited<ReturnType<typeof createTestTask>>;
  let basePath: string;

  beforeAll(async () => {
    await cleanupDatabase();
    user = await createTestUser(app);
    workspace = await createTestWorkspace(app, user.cookie);
    project = await createTestProject(app, user.cookie, workspace.id);
    task = await createTestTask(app, user.cookie, workspace.id, project.id);
    basePath = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}/development-flow`;
  });

  afterAll(async () => closeDbConnection());

  it("enforces plan and review gates before a development task can be completed", async () => {
    const enabled = await request(app)
      .post(basePath)
      .set("Cookie", user.cookie)
      .send({ acceptanceCriteria: ["The endpoint has integration tests"] });
    expect(enabled.status).toBe(201);
    expect(enabled.body.flow.state).toBe("idea");

    const doneStatus = project.statuses.find((status) => status.category === "done");
    expect(doneStatus).toBeDefined();
    const blockedBoardMove = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`)
      .set("Cookie", user.cookie)
      .set("If-Match", '"1"')
      .send({ statusId: doneStatus?.id });
    expect(blockedBoardMove.status).toBe(409);
    expect(blockedBoardMove.body.error.code).toBe("DEVELOPMENT_FLOW_REVIEW_REQUIRED");

    expect((await move("planning")).status).toBe(200);
    const incompletePlan = await move("approval");
    expect(incompletePlan.status).toBe(409);
    expect(incompletePlan.body.error.code).toBe("DEVELOPMENT_FLOW_PLAN_INCOMPLETE");

    const details = await request(app)
      .patch(basePath)
      .set("Cookie", user.cookie)
      .send({ implementationPlan: "Add the route, update schemas, and verify with integration tests." });
    expect(details.status).toBe(200);

    expect((await move("approval")).status).toBe(200);
    const approvedPlan = await request(app)
      .post(`${basePath}/approve-plan`)
      .set("Cookie", user.cookie)
      .send({});
    expect(approvedPlan.status).toBe(200);
    expect(approvedPlan.body.flow.state).toBe("ready");

    expect((await move("in_progress")).status).toBe(200);
    const blockedReview = await move("review");
    expect(blockedReview.status).toBe(409);
    expect(blockedReview.body.error.code).toBe("DEVELOPMENT_FLOW_REVIEW_INCOMPLETE");

    const deliveryDetails = await request(app)
      .patch(basePath)
      .set("Cookie", user.cookie)
      .send({
        branchName: "feature/dev-flow",
        ciStatus: "passing",
        pullRequestUrl: "https://github.com/acme/devflow/pull/42",
        summary: "Development Flow delivered with gates.",
        testInstructions: "Run the Development Flow integration suite.",
      });
    expect(deliveryDetails.status).toBe(200);
    expect((await move("review")).status).toBe(200);

    const completed = await request(app)
      .post(`${basePath}/approve-review`)
      .set("Cookie", user.cookie)
      .send({});
    expect(completed.status).toBe(200);
    expect(completed.body.flow.state).toBe("done");

    const taskAfterFlow = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`)
      .set("Cookie", user.cookie);
    const done = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${task.id}`)
      .set("Cookie", user.cookie)
      .set("If-Match", `\"${taskAfterFlow.body.task.version}\"`)
      .send({ statusId: doneStatus?.id });
    expect(done.status).toBe(200);
    expect(done.body.task.status.category).toBe("done");
  });

  it("records an agent session only after the flow is in progress", async () => {
    const sessionTask = await createTestTask(app, user.cookie, workspace.id, project.id);
    const path = `/api/v1/workspaces/${workspace.id}/projects/${project.id}/tasks/${sessionTask.id}/development-flow`;
    await request(app).post(path).set("Cookie", user.cookie).send({ acceptanceCriteria: ["Ship it"] });
    await request(app).post(`${path}/transition`).set("Cookie", user.cookie).send({ state: "planning" });
    await request(app).patch(path).set("Cookie", user.cookie).send({ implementationPlan: "Implement it." });
    await request(app).post(`${path}/transition`).set("Cookie", user.cookie).send({ state: "approval" });
    await request(app).post(`${path}/approve-plan`).set("Cookie", user.cookie).send({});
    await request(app).post(`${path}/transition`).set("Cookie", user.cookie).send({ state: "in_progress" });

    const session = await request(app)
      .post(`${path}/sessions`)
      .set("Cookie", user.cookie)
      .send({ agentName: "Codex", client: "Codex" });
    expect(session.status).toBe(201);
    expect(session.body.session.status).toBe("active");
    expect(session.body.session.startedBy.id).toBe(user.user.id);
  });

  function move(state: string) {
    return request(app)
      .post(`${basePath}/transition`)
      .set("Cookie", user.cookie)
      .send({ state });
  }
});

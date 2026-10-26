import { beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  createTestApp,
  createTestUser,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Account sessions", () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  it("lists sessions and can end selected or all other sessions", async () => {
    const user = await createTestUser(app);
    const secondLogin = await request(app).post("/api/v1/auth/login").send({
      email: user.email,
      password: user.password,
    });
    const secondCookie = secondLogin.headers["set-cookie"][0];

    const sessionsResponse = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Cookie", user.cookie);

    expect(sessionsResponse.status).toBe(200);
    expect(sessionsResponse.body.sessions).toHaveLength(2);
    expect(sessionsResponse.body.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ current: true, id: expect.any(String) }),
        expect.objectContaining({ current: false, id: expect.any(String) }),
      ]),
    );

    const secondSession = sessionsResponse.body.sessions.find(
      (session: { current: boolean }) => !session.current,
    );
    expect(secondSession).toBeDefined();
    const endSelectedResponse = await request(app)
      .delete(`/api/v1/auth/sessions/${secondSession?.id}`)
      .set("Cookie", user.cookie);

    expect(endSelectedResponse.status).toBe(204);
    const secondSessionMe = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", secondCookie);
    expect(secondSessionMe.status).toBe(401);

    const thirdLogin = await request(app).post("/api/v1/auth/login").send({
      email: user.email,
      password: user.password,
    });
    const thirdCookie = thirdLogin.headers["set-cookie"][0];

    const endOthersResponse = await request(app)
      .post("/api/v1/auth/sessions/revoke-others")
      .set("Cookie", user.cookie);
    expect(endOthersResponse.status).toBe(204);

    const remainingSessions = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Cookie", user.cookie);
    expect(remainingSessions.body.sessions).toEqual([
      expect.objectContaining({ current: true }),
    ]);

    const thirdSessionMe = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", thirdCookie);
    expect(thirdSessionMe.status).toBe(401);
  });
});

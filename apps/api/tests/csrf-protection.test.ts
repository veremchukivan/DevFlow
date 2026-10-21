import { describe, expect, it } from "vitest";

import { validateCsrfOrigin } from "../src/core/http/csrf-protection.js";

describe("CSRF origin validation", () => {
  const webOrigins = ["https://app.devflow.example"];

  it("allows state-changing browser requests from the configured web origin", () => {
    expect(
      validateCsrfOrigin({
        nodeEnv: "production",
        origin: webOrigins[0],
        webOrigins,
      }),
    ).toBe("valid");
  });

  it("rejects missing and untrusted origins in production", () => {
    expect(
      validateCsrfOrigin({
        nodeEnv: "production",
        origin: undefined,
        webOrigins,
      }),
    ).toBe("missing");
    expect(
      validateCsrfOrigin({
        nodeEnv: "production",
        origin: "https://attacker.example",
        webOrigins,
      }),
    ).toBe("invalid");
  });

  it("keeps origin-less requests available outside production for local tools", () => {
    expect(
      validateCsrfOrigin({
        nodeEnv: "development",
        origin: undefined,
        webOrigins,
      }),
    ).toBe("valid");
    expect(
      validateCsrfOrigin({
        nodeEnv: "test",
        origin: undefined,
        webOrigins,
      }),
    ).toBe("valid");
  });

  it("allows an explicitly configured additional origin", () => {
    expect(
      validateCsrfOrigin({
        nodeEnv: "production",
        origin: "http://127.0.0.1:3001",
        webOrigins: [webOrigins[0]!, "http://127.0.0.1:3001"],
      }),
    ).toBe("valid");
  });
});

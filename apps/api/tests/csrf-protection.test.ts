import { describe, expect, it } from "vitest";

import { validateCsrfOrigin } from "../src/core/http/csrf-protection.js";

describe("CSRF origin validation", () => {
  const webOrigin = "https://app.devflow.example";

  it("allows state-changing browser requests from the configured web origin", () => {
    expect(
      validateCsrfOrigin({
        nodeEnv: "production",
        origin: webOrigin,
        webOrigin
      })
    ).toBe("valid");
  });

  it("rejects missing and untrusted origins in production", () => {
    expect(
      validateCsrfOrigin({
        nodeEnv: "production",
        origin: undefined,
        webOrigin
      })
    ).toBe("missing");
    expect(
      validateCsrfOrigin({
        nodeEnv: "production",
        origin: "https://attacker.example",
        webOrigin
      })
    ).toBe("invalid");
  });

  it("keeps origin-less requests available outside production for local tools", () => {
    expect(
      validateCsrfOrigin({
        nodeEnv: "development",
        origin: undefined,
        webOrigin
      })
    ).toBe("valid");
    expect(
      validateCsrfOrigin({
        nodeEnv: "test",
        origin: undefined,
        webOrigin
      })
    ).toBe("valid");
  });
});

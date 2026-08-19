import { describe, it, expect } from "vitest";
import { validateBaseUrl, validateToken } from "./domain/config";
import { parseState } from "./domain/resource";
import { formatApiError } from "./domain/api-error";

describe("formatApiError", () => {
  it("appends Laravel's per-field errors to the bare headline", () => {
    // Without the field bag this reads as just "Validation failed." — useless.
    const msg = formatApiError(422, {
      message: "Validation failed.",
      errors: { ports_exposes: ["The ports exposes field is required."] },
    });
    expect(msg).toContain("Validation failed.");
    expect(msg).toContain("ports_exposes");
    expect(msg).toContain("The ports exposes field is required.");
  });

  it("joins several failing fields", () => {
    const msg = formatApiError(422, {
      message: "Validation failed.",
      errors: { name: ["required"], git_branch: ["required"] },
    });
    expect(msg).toContain("name: required");
    expect(msg).toContain("git_branch: required");
  });

  it("accepts a string (not array) reason", () => {
    const msg = formatApiError(422, { message: "Nope", errors: { name: "required" } });
    expect(msg).toContain("name: required");
  });

  it("falls back to the headline when there is no field bag", () => {
    expect(formatApiError(500, { message: "Server exploded" })).toBe("Coolify: Server exploded");
  });

  it("falls back to the status code when the body is unparseable", () => {
    expect(formatApiError(502, null)).toBe("Coolify: HTTP 502");
  });

  it("keeps the friendly auth and not-found messages", () => {
    expect(formatApiError(401, null)).toMatch(/Token inválido/);
    expect(formatApiError(403, null)).toMatch(/Token inválido/);
    expect(formatApiError(404, null)).toMatch(/No encontrado/);
  });
});

describe("validateBaseUrl", () => {
  it("strips a trailing slash", () => {
    const r = validateBaseUrl("https://coolify.example.com/");
    expect(r.ok && r.value).toBe("https://coolify.example.com");
  });
  it("rejects a non-http URL", () => {
    expect(validateBaseUrl("ftp://x").ok).toBe(false);
  });
  it("rejects garbage", () => {
    expect(validateBaseUrl("not a url").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateBaseUrl("  ").ok).toBe(false);
  });
});

describe("validateToken", () => {
  it("trims and accepts a token", () => {
    const r = validateToken("  67|abc  ");
    expect(r.ok && r.value).toBe("67|abc");
  });
  it("rejects empty", () => {
    expect(validateToken("").ok).toBe(false);
  });
});

describe("parseState", () => {
  it("maps running:healthy → running/healthy", () => {
    expect(parseState("running:healthy")).toEqual({
      state: "running",
      healthy: true,
    });
  });
  it("maps running:unhealthy → degraded", () => {
    const r = parseState("running:unhealthy");
    expect(r.state).toBe("degraded");
    expect(r.healthy).toBe(false);
  });
  it("maps exited/stopped → stopped", () => {
    expect(parseState("exited:unhealthy").state).toBe("stopped");
    expect(parseState("stopped").state).toBe("stopped");
  });
  it("maps restarting → degraded", () => {
    expect(parseState("restarting").state).toBe("degraded");
  });
  it("handles empty/unknown", () => {
    expect(parseState("").state).toBe("unknown");
    expect(parseState(undefined).state).toBe("unknown");
  });
});

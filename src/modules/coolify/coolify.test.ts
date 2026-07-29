import { describe, it, expect } from "vitest";
import { validateBaseUrl, validateToken } from "./domain/config";
import { parseState } from "./domain/resource";

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

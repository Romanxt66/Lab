import { describe, it, expect } from "vitest";
import { validateBaseUrl, validateApiKey } from "./domain/config";

describe("n8n validateBaseUrl", () => {
  it("accepts a valid https URL and strips a trailing slash", () => {
    const res = validateBaseUrl("https://n8n.midominio.com/");
    expect(res.ok && res.value).toBe("https://n8n.midominio.com");
  });

  it("rejects an empty URL", () => {
    expect(validateBaseUrl("  ").ok).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(validateBaseUrl("not a url").ok).toBe(false);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(validateBaseUrl("ftp://n8n.midominio.com").ok).toBe(false);
  });
});

describe("n8n validateApiKey", () => {
  it("accepts a non-empty key", () => {
    expect(validateApiKey("abc123").ok).toBe(true);
  });

  it("rejects an empty key", () => {
    expect(validateApiKey("   ").ok).toBe(false);
  });
});

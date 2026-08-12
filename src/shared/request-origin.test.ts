import { describe, it, expect } from "vitest";
import { publicOrigin } from "./request-origin";

function reqWith(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe("publicOrigin", () => {
  it("prefers the proxy's forwarded host and proto", () => {
    // What Coolify/Traefik sends: the container is hit on localhost:3000 but
    // the user is really on the public domain over HTTPS.
    const req = reqWith("http://localhost:3000/api/auth/google/login/callback", {
      "x-forwarded-host": "lab.softlane.click",
      "x-forwarded-proto": "https",
      host: "localhost:3000",
    });
    expect(publicOrigin(req)).toBe("https://lab.softlane.click");
  });

  it("takes the first entry of a forwarded chain", () => {
    const req = reqWith("http://localhost:3000/x", {
      "x-forwarded-host": "lab.softlane.click, internal.proxy",
      "x-forwarded-proto": "https, http",
    });
    expect(publicOrigin(req)).toBe("https://lab.softlane.click");
  });

  it("falls back to the Host header when only it is present", () => {
    const req = reqWith("http://localhost:3000/x", { host: "lab.softlane.click" });
    expect(publicOrigin(req)).toBe("http://lab.softlane.click");
  });

  it("falls back to the request URL with no proxy headers (local dev)", () => {
    const req = reqWith("http://localhost:3000/x");
    expect(publicOrigin(req)).toBe("http://localhost:3000");
  });

  it("ignores empty forwarded headers", () => {
    const req = reqWith("https://lab.softlane.click/x", {
      "x-forwarded-host": "",
      "x-forwarded-proto": "",
    });
    expect(publicOrigin(req)).toBe("https://lab.softlane.click");
  });
});

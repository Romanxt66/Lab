import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  fetchUserInfo,
} from "./application/google-oauth";
import { GMAIL_SEND_SCOPE } from "./domain/google-account";

const cfg = {
  clientId: "cid.apps.googleusercontent.com",
  clientSecret: "csecret",
  redirectUri: "https://app.example.com/api/auth/google/callback",
};

describe("buildAuthUrl", () => {
  const url = new URL(buildAuthUrl(cfg, "abc.def"));

  it("targets Google's OAuth endpoint", () => {
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
  });

  it("requests offline access + shows the account picker + forces consent", () => {
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("select_account consent");
    expect(url.searchParams.get("scope")).toBe(GMAIL_SEND_SCOPE);
  });

  it("passes through client id, redirect and state", () => {
    expect(url.searchParams.get("client_id")).toBe(cfg.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(cfg.redirectUri);
    expect(url.searchParams.get("state")).toBe("abc.def");
  });
});

describe("token endpoints", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exchangeCode parses the token response", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
          scope: GMAIL_SEND_SCOPE,
          token_type: "Bearer",
        }),
        { status: 200 },
      ),
    );
    const tokens = await exchangeCode(cfg, "the-code");
    expect(tokens.access_token).toBe("at");
    expect(tokens.refresh_token).toBe("rt");
    // Sent a POST to the token URL.
    const call = spy.mock.calls[0]!;
    expect(call[0]).toBe("https://oauth2.googleapis.com/token");
    expect((call[1] as RequestInit).method).toBe("POST");
  });

  it("exchangeCode throws on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad", { status: 400 }),
    );
    await expect(exchangeCode(cfg, "x")).rejects.toThrow(/400/);
  });

  it("refreshAccessToken returns an accessToken + expiry", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "fresh", expires_in: 3600 }),
        { status: 200 },
      ),
    );
    const before = Date.now();
    const { accessToken, expiresAt } = await refreshAccessToken(cfg, "rt");
    expect(accessToken).toBe("fresh");
    // Expiry should be roughly one hour in the future.
    expect(expiresAt.getTime() - before).toBeGreaterThan(3_500_000);
  });

  it("fetchUserInfo returns the profile shape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sub: "1",
          email: "user@example.com",
          name: "User",
          picture: "https://pic",
        }),
        { status: 200 },
      ),
    );
    const info = await fetchUserInfo("at");
    expect(info.email).toBe("user@example.com");
    expect(info.name).toBe("User");
  });
});

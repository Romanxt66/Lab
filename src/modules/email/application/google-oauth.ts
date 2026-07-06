/**
 * Google OAuth 2.0 helpers — pure functions, no framework. Server-only in
 * practice (they build URLs and hit token endpoints), but the module has no
 * `server-only` marker so it can be unit-tested with `fetch` mocked.
 */

import { GMAIL_SEND_SCOPE } from "@/modules/email/domain/google-account";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Build the URL to redirect the user to Google's consent screen.
 * - `prompt=select_account consent`: shows the same account picker Gmail uses
 *   and forces a fresh consent so we ALWAYS get a refresh_token back.
 * - `access_type=offline`: required to receive a refresh_token.
 */
export function buildAuthUrl(cfg: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GMAIL_SEND_SCOPE,
    access_type: "offline",
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

/** Exchange the authorization code returned to /callback for tokens. */
export async function exchangeCode(
  cfg: OAuthConfig,
  code: string,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: cfg.redirectUri,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Refresh an access token using a stored refresh_token. */
export async function refreshAccessToken(
  cfg: OAuthConfig,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

/** Fetch profile info for the authenticated user with an access token. */
export async function fetchUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google userinfo failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as GoogleUserInfo;
}

import { NextResponse } from "next/server";
import { assertGoogleOAuth } from "@/shared/env";
import { buildAuthUrl } from "@/modules/email/application/google-oauth";
import {
  createState,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
} from "@/modules/email/infrastructure/oauth-state";

/**
 * Kick off the Google OAuth flow. The user is redirected to Google's account
 * picker (same one used by "Sign in with Google" everywhere) and, on success,
 * bounced back to /api/auth/google/callback.
 */
export async function GET() {
  let cfg;
  try {
    cfg = assertGoogleOAuth();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OAuth no configurado" },
      { status: 500 },
    );
  }

  const state = createState();
  const authUrl = buildAuthUrl(
    {
      clientId: cfg.GOOGLE_CLIENT_ID,
      clientSecret: cfg.GOOGLE_CLIENT_SECRET,
      redirectUri: cfg.GOOGLE_REDIRECT_URI,
    },
    state,
  );

  const res = NextResponse.redirect(authUrl);
  // Short-lived state cookie so the callback can verify the round-trip.
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  return res;
}

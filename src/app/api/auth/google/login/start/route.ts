import { NextResponse } from "next/server";
import { assertGoogleLoginOAuth } from "@/shared/env";
import { buildAuthUrl } from "@/modules/email/application/google-oauth";
import { GOOGLE_LOGIN_SCOPE } from "@/modules/auth/application/google-login";
import {
  createState,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
} from "@/modules/email/infrastructure/oauth-state";

/**
 * Kick off "Sign in with Google" for login/registration — a separate flow
 * from the email module's "connect a mailbox to send from" OAuth (narrower
 * scope, no refresh token needed, same Google Cloud OAuth client).
 */
export async function GET() {
  let cfg;
  try {
    cfg = assertGoogleLoginOAuth();
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
      redirectUri: cfg.GOOGLE_LOGIN_REDIRECT_URI,
    },
    state,
    { scope: GOOGLE_LOGIN_SCOPE, offline: false, forceConsent: false },
  );

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  return res;
}

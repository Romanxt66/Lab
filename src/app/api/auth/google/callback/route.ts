import { NextResponse } from "next/server";
import { assertGoogleOAuth } from "@/shared/env";
import {
  exchangeCode,
  fetchUserInfo,
} from "@/modules/email/application/google-oauth";
import {
  verifyState,
  OAUTH_STATE_COOKIE,
} from "@/modules/email/infrastructure/oauth-state";
import { getGoogleAccountRepo } from "@/shared/di/container";

/**
 * OAuth callback: verify the state, exchange the code for tokens, fetch the
 * user's email/name, save the account, then redirect back to the email tool.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  // Where to send the user after we're done.
  const backUrl = new URL("/tools/email-automation", url.origin);

  if (err) {
    backUrl.searchParams.set("google", "error");
    backUrl.searchParams.set("reason", err);
    return NextResponse.redirect(backUrl);
  }

  const cookieState = req.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(OAUTH_STATE_COOKIE.length + 1);

  if (!code || !state || state !== cookieState || !verifyState(state)) {
    backUrl.searchParams.set("google", "error");
    backUrl.searchParams.set("reason", "state");
    const res = NextResponse.redirect(backUrl);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }

  let cfg;
  try {
    cfg = assertGoogleOAuth();
  } catch (e) {
    backUrl.searchParams.set("google", "error");
    backUrl.searchParams.set(
      "reason",
      e instanceof Error ? e.message : "not-configured",
    );
    return NextResponse.redirect(backUrl);
  }

  try {
    const tokens = await exchangeCode(
      {
        clientId: cfg.GOOGLE_CLIENT_ID,
        clientSecret: cfg.GOOGLE_CLIENT_SECRET,
        redirectUri: cfg.GOOGLE_REDIRECT_URI,
      },
      code,
    );
    const profile = await fetchUserInfo(tokens.access_token);

    await getGoogleAccountRepo().upsert({
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
      refreshToken: tokens.refresh_token ?? "",
      accessToken: tokens.access_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    });

    backUrl.searchParams.set("google", "ok");
    backUrl.searchParams.set("email", profile.email);
  } catch (e) {
    backUrl.searchParams.set("google", "error");
    backUrl.searchParams.set(
      "reason",
      e instanceof Error ? e.message : "unknown",
    );
  }

  const res = NextResponse.redirect(backUrl);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

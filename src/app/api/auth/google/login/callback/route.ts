import { NextResponse } from "next/server";
import { assertGoogleLoginOAuth } from "@/shared/env";
import {
  exchangeCode,
  fetchUserInfo,
} from "@/modules/email/application/google-oauth";
import {
  verifyState,
  OAUTH_STATE_COOKIE,
} from "@/modules/email/infrastructure/oauth-state";
import { getGoogleLogin } from "@/shared/di/container";
import { publicOrigin } from "@/shared/request-origin";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/shared/session";

/**
 * OAuth callback for "Sign in with Google". On success either logs the user
 * in (approved account) or leaves a friendly message on /login (pending,
 * rejected, or brand-new — which self-registers as pending).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthErr = url.searchParams.get("error");
  // NOT url.origin: behind Coolify's proxy that is the container's internal
  // host (localhost:3000), which would redirect the user off-site.
  const origin = publicOrigin(req);
  const loginUrl = new URL("/login", origin);

  function fail(message: string) {
    loginUrl.searchParams.set("error", message);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }

  if (oauthErr) return fail("No se pudo continuar con Google.");

  const cookieState = req.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(OAUTH_STATE_COOKIE.length + 1);

  if (!code || !state || state !== cookieState || !verifyState(state)) {
    return fail("La sesión con Google expiró, inténtalo de nuevo.");
  }

  let cfg;
  try {
    cfg = assertGoogleLoginOAuth();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Google no está configurado.");
  }

  try {
    const tokens = await exchangeCode(
      {
        clientId: cfg.GOOGLE_CLIENT_ID,
        clientSecret: cfg.GOOGLE_CLIENT_SECRET,
        redirectUri: cfg.GOOGLE_LOGIN_REDIRECT_URI,
      },
      code,
    );
    const profile = await fetchUserInfo(tokens.access_token);

    const login = await getGoogleLogin().execute({
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
    });
    if (!login.ok) return fail(login.error);

    // The Google account was linked fine; it just isn't cleared to enter yet.
    // Send the user back to /login with a status (not an error) to explain.
    if (login.value.kind !== "session") {
      loginUrl.searchParams.set(
        "status",
        login.value.kind === "pending"
          ? login.value.isNew
            ? "registered"
            : "pending"
          : "rejected",
      );
      loginUrl.searchParams.set("email", profile.email);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete(OAUTH_STATE_COOKIE);
      return res;
    }

    const { user } = login.value;
    const token = await createSessionToken({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const res = NextResponse.redirect(new URL("/", origin));
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Error al continuar con Google.");
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/shared/session";

/**
 * Auth gate (Next 16 "proxy", formerly middleware). Runs on the Edge for every
 * page request (see matcher). Redirects unauthenticated users to /login, and
 * authenticated users away from /login. API routes are excluded (they carry
 * their own auth, e.g. /api/cron).
 */
export async function proxy(req: NextRequest) {
  const session = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE)?.value,
  );
  const isLogin = req.nextUrl.pathname === "/login";

  if (!session && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (session && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

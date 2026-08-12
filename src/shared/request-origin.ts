/**
 * Public origin of an incoming request (e.g. `https://lab.example.com`).
 *
 * Behind a reverse proxy (Coolify/Traefik, nginx, Vercel) `req.url` can carry
 * the *internal* host the container was reached on — typically
 * `http://localhost:3000` — so building redirects from it would bounce the user
 * to the container instead of the site. The proxy tells us the real host via
 * `X-Forwarded-*`; prefer those, then the `Host` header, then the raw URL.
 *
 * Framework-free and side-effect-free so it can be unit-tested directly.
 */
export function publicOrigin(req: Request): string {
  const url = new URL(req.url);

  // Forwarded headers may be a comma-separated chain ("a.com, b.com"); the
  // first entry is the original client-facing value.
  const first = (name: string): string | null => {
    const raw = req.headers.get(name);
    if (!raw) return null;
    const value = raw.split(",")[0]?.trim();
    return value ? value : null;
  };

  const proto = first("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  const host = first("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

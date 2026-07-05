/**
 * Stateless signed sessions using HMAC-SHA256 over the Web Crypto API.
 *
 * Deliberately free of `server-only` and `next/headers` so it can run in BOTH
 * the Edge middleware and the Node server. Token format: `<b64url payload>.<b64url sig>`.
 * The payload is signed (tamper-proof) but NOT encrypted — don't put secrets in it.
 */

export const SESSION_COOKIE = "lab_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

export interface SessionPayload {
  uid: string;
  email: string;
  name: string | null;
  role: string;
  exp: number; // unix seconds
}

function secret(): string {
  return (
    process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me"
  );
}

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Sign a payload (without `exp`) into a session token valid for SESSION_MAX_AGE. */
export async function createSessionToken(
  data: Omit<SessionPayload, "exp">,
): Promise<string> {
  const payload: SessionPayload = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body) as BufferSource,
  );
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Verify a token's signature and expiry; returns the payload or null. */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sig) as BufferSource,
      encoder.encode(body) as BufferSource,
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as SessionPayload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

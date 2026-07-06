import "server-only";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/shared/env";

/**
 * OAuth `state` value: a random nonce + HMAC signature.
 * Format: `<nonceHex>.<sigHex>`. Signed with SESSION_SECRET so we can verify
 * the callback wasn't triggered by a third party (CSRF protection).
 */

const SECRET = () => env.SESSION_SECRET;

export function createState(): string {
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", SECRET()).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}

export function verifyState(state: string | null | undefined): boolean {
  if (!state) return false;
  const [nonce, sig] = state.split(".");
  if (!nonce || !sig) return false;
  const expected = createHmac("sha256", SECRET()).update(nonce).digest("hex");
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

export const OAUTH_STATE_COOKIE = "lab_oauth_state";
export const OAUTH_STATE_MAX_AGE = 60 * 10; // 10 minutes

import "server-only";
import { cookies } from "next/headers";
import {
  verifySessionToken,
  SESSION_COOKIE,
  type SessionPayload,
} from "@/shared/session";

/** Read and verify the current session from the cookie (server components). */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

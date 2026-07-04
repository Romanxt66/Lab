import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node — no native/extra deps).
 * Stored format: `scrypt$<saltHex>$<hashHex>`.
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(plain, salt, expected.length);
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

/** Generate a strong random password (URL-safe). */
export function generatePassword(length = 18): string {
  return randomBytes(length)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .slice(0, length);
}

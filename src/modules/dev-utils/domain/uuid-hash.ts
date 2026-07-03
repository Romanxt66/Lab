import { type Result, ok, err } from "@/shared/kernel/result";

export type HashAlgo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export const HASH_ALGOS: HashAlgo[] = [
  "SHA-1",
  "SHA-256",
  "SHA-384",
  "SHA-512",
];

/** Generate a v4 UUID. */
export function generateUuid(): string {
  return crypto.randomUUID();
}

/** Generate `count` UUIDs (1–100). */
export function generateUuids(count: number): string[] {
  const n = Math.max(1, Math.min(100, Math.floor(count) || 1));
  return Array.from({ length: n }, () => crypto.randomUUID());
}

/** Hash text with the Web Crypto API, returning a lowercase hex digest. */
export async function hashText(
  algo: HashAlgo,
  text: string,
): Promise<Result<string>> {
  try {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest(algo, data);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return ok(hex);
  } catch (e) {
    return err(e instanceof Error ? e.message : "No se pudo calcular el hash.");
  }
}

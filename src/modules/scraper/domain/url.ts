import { type Result, ok, err } from "@/shared/kernel/result";

/** Validate and normalise an http(s) URL. Rejects other schemes. */
export function validateUrl(raw: string): Result<string> {
  const trimmed = raw.trim();
  if (!trimmed) return err("Introduce una URL.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return err("URL inválida.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err("Solo se admiten URLs http(s).");
  }
  return ok(url.toString());
}

import { type Result, ok, err } from "@/shared/kernel/result";

/** UTF-8 safe Base64 encode (works in browser and Node). */
export function encodeBase64(input: string): Result<string> {
  try {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return ok(btoa(binary));
  } catch (e) {
    return err(e instanceof Error ? e.message : "No se pudo codificar.");
  }
}

/** UTF-8 safe Base64 decode. */
export function decodeBase64(input: string): Result<string> {
  const trimmed = input.trim();
  if (!trimmed) return err("Introduce texto en Base64.");
  try {
    const binary = atob(trimmed);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return ok(new TextDecoder().decode(bytes));
  } catch {
    return err("Base64 inválido.");
  }
}

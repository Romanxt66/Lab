import { type Result, ok, err } from "@/shared/kernel/result";

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  /** Expiry (`exp`) as a Date, if present. */
  expiresAt: Date | null;
  isExpired: boolean | null;
}

/** Decode a JWT WITHOUT verifying its signature (inspection only). */
export function decodeJwt(token: string): Result<DecodedJwt> {
  const trimmed = token.trim();
  if (!trimmed) return err("Introduce un JWT.");

  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return err("Un JWT debe tener 3 partes separadas por puntos.");
  }

  try {
    const header = parseSegment(parts[0]);
    const payload = parseSegment(parts[1]);
    const exp =
      typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;

    return ok({
      header,
      payload,
      signature: parts[2],
      expiresAt: exp,
      isExpired: exp ? exp.getTime() < Date.now() : null,
    });
  } catch {
    return err("No se pudo decodificar el JWT (Base64URL inválido).");
  }
}

function parseSegment(segment: string): Record<string, unknown> {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

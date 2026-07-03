import { type Result, ok, err } from "@/shared/kernel/result";

export interface EmailMessage {
  to: string[];
  subject: string;
  body: string;
}

// Pragmatic email shape check — not RFC-perfect, but rejects obvious mistakes.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Split a raw recipients string (commas / semicolons / newlines) into buckets. */
export function parseRecipients(raw: string): {
  valid: string[];
  invalid: string[];
} {
  const parts = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) (isValidEmail(p) ? valid : invalid).push(p);
  return { valid: [...new Set(valid)], invalid };
}

/** Validate a message before it reaches the sender port. */
export function validateMessage(msg: EmailMessage): Result<EmailMessage> {
  if (msg.to.length === 0) return err("Añade al menos un destinatario válido.");
  const bad = msg.to.filter((t) => !isValidEmail(t));
  if (bad.length) return err(`Destinatarios inválidos: ${bad.join(", ")}`);
  if (!msg.subject.trim()) return err("El asunto no puede estar vacío.");
  if (!msg.body.trim()) return err("El cuerpo no puede estar vacío.");
  return ok(msg);
}

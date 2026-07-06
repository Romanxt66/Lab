import { type Result, ok, err } from "@/shared/kernel/result";

export type WhatsAppProvider = "callmebot";
export const WHATSAPP_PROVIDERS: WhatsAppProvider[] = ["callmebot"];

export interface WhatsAppConfig {
  id: string;
  provider: WhatsAppProvider;
  /** International format WITHOUT leading `+`, e.g. `573001234567`. */
  phone: string;
  apiKey: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Serializable projection sent to the client (no apiKey). */
export interface WhatsAppConfigDTO {
  id: string;
  provider: WhatsAppProvider;
  phone: string;
  active: boolean;
  hasApiKey: boolean;
}

export function toWhatsAppConfigDTO(c: WhatsAppConfig): WhatsAppConfigDTO {
  return {
    id: c.id,
    provider: c.provider,
    phone: c.phone,
    active: c.active,
    hasApiKey: Boolean(c.apiKey && c.apiKey.length > 0),
  };
}

/** Normalise a raw phone input (accept +, spaces, dashes) into digits-only. */
export function normalisePhone(raw: string): Result<string> {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 7) return err("El número parece demasiado corto.");
  if (digits.length > 15) return err("El número parece demasiado largo.");
  return ok(digits);
}
